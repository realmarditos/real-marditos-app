import { useCallback, useEffect, useState } from 'react'
import { supabase, errorText } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import type { Player, Rating, Role, Status } from '../../lib/types'
import { ROLE_LABEL } from '../../lib/types'
import { overall } from '../../lib/draw'
import { AdminHeader, Avatar, Icon, useToast } from '../../components/ui'
import { isPin } from '../../lib/supabase'

type Filter = 'todos' | 'ativo' | 'afastado'
const ATTRS: { key: keyof Omit<Rating, 'player_id'>; label: string }[] = [
  { key: 'tecnica', label: 'Técnica' },
  { key: 'fisico', label: 'Físico' },
  { key: 'marcacao', label: 'Marcação' },
  { key: 'finalizacao', label: 'Finalização' },
]

export default function Members() {
  const { player: me } = useAuth()
  const [players, setPlayers] = useState<Player[]>([])
  const [pending, setPending] = useState<Player[]>([])
  const [ratings, setRatings] = useState<Record<string, Rating>>({})
  const [filter, setFilter] = useState<Filter>('todos')
  const [editing, setEditing] = useState<Player | 'novo' | null>(null)
  const [codeOpen, setCodeOpen] = useState(false)
  const { toast, toastNode } = useToast()

  const load = useCallback(async () => {
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from('players').select('*').order('name'),
      supabase.from('player_ratings').select('*'),
    ])
    const all = ((p as Player[]) ?? []).filter((x) => !x.is_guest)
    setPending(all.filter((x) => x.approved === false))
    setPlayers(all.filter((x) => x.approved !== false))
    setRatings(Object.fromEntries(((r as Rating[]) ?? []).map((x) => [x.player_id, x])))
  }, [])
  useEffect(() => { load() }, [load])

  async function decide(p: Player, ok: boolean) {
    const { error } = await supabase.rpc(ok ? 'approve_member' : 'reject_member', { pid: p.id })
    if (error) return toast(errorText(error))
    toast(ok ? `${p.name} aprovado` : `Pedido de ${p.name} recusado`)
    load()
  }

  const count = (s?: Status) => players.filter((p) => !s || p.status === s).length
  const list = players.filter((p) => filter === 'todos' || p.status === filter)

  return (
    <main className="screen">
      <AdminHeader title="Membros" right={<button className="btn sm blue" onClick={() => setEditing('novo')}>+ Novo</button>} />
      {pending.length > 0 && me?.role !== 'tesoureiro' && (
        <section className="card stack" style={{ gap: 10, border: '1px solid var(--gold)' }}>
          <p className="eyebrow gold" style={{ margin: 0 }}>Pedidos de entrada · {pending.length}</p>
          {pending.map((p) => (
            <div key={p.id} className="row" style={{ gap: 10 }}>
              <Avatar avatar={p.avatar} seed={p.name} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 500 }}>{p.name}</span>
                <span className="caption muted" style={{ display: 'block' }}>{p.self_created ? 'Jogador novo' : 'Escolheu o nome da lista'}</span>
              </span>
              <button className="btn sm ghost" onClick={() => decide(p, false)}>Recusar</button>
              <button className="btn sm gold" onClick={() => decide(p, true)}>Aprovar</button>
            </div>
          ))}
        </section>
      )}

      <div className="row">
        {(['todos', 'ativo', 'afastado'] as Filter[]).map((f) => (
          <button key={f} className={`chip ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>
            {f === 'todos' ? 'Todos' : f === 'ativo' ? 'Ativos' : 'Afastados'} · {count(f === 'todos' ? undefined : f)}
          </button>
        ))}
      </div>
      <p className="row caption muted" style={{ margin: 0, gap: 6 }}><Icon name="lock" size={14} />Notas visíveis só para a diretoria</p>

      <div className="stack" style={{ gap: 6 }}>
        {list.map((p) => (
          <button key={p.id} className="list-row" onClick={() => setEditing(p)}>
            <Avatar avatar={p.avatar} seed={p.name} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 500 }}>{p.name}</span>
              <span className="caption" style={{ display: 'block', color: p.status === 'afastado' ? 'var(--danger)' : 'var(--ink-muted)' }}>
                {[p.is_goalkeeper ? 'Goleiro' : p.position || 'Linha', p.status === 'afastado' ? 'Afastado' : 'Ativo', p.role !== 'membro' ? ROLE_LABEL[p.role] : null, p.user_id ? null : 'Sem conta'].filter(Boolean).join(' · ')}
              </span>
            </span>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 20 }}>{overall(ratings[p.id]).toFixed(1)}</span>
          </button>
        ))}
      </div>

      {me?.role === 'presidente' && (
        <button className="btn ghost block sm" onClick={() => setCodeOpen(true)}><Icon name="settings" size={18} />Código do clube</button>
      )}

      {editing && (
        <EditSheet
          player={editing === 'novo' ? null : editing}
          rating={editing === 'novo' ? undefined : ratings[editing.id]}
          isPresident={me?.role === 'presidente'}
          onClose={async (msg) => { setEditing(null); if (msg) { toast(msg); load() } }}
        />
      )}
      {codeOpen && <ClubCodeSheet onClose={(msg) => { setCodeOpen(false); if (msg) toast(msg) }} />}
      {toastNode}
    </main>
  )
}

function EditSheet({ player, rating, isPresident, onClose }: { player: Player | null; rating?: Rating; isPresident: boolean; onClose: (msg?: string) => void }) {
  const [name, setName] = useState(player?.name ?? '')
  const [gk, setGk] = useState(player?.is_goalkeeper ?? false)
  const [status, setStatus] = useState<Status>(player?.status ?? 'ativo')
  const [role, setRole] = useState<Role>(player?.role ?? 'membro')
  const [points, setPoints] = useState(String(player?.initial_points ?? 0))
  const [birthday, setBirthday] = useState(player?.birthday ?? '')
  const [newPin, setNewPin] = useState('')
  const [pinMsg, setPinMsg] = useState('')
  const [r, setR] = useState<Omit<Rating, 'player_id'>>({
    tecnica: rating?.tecnica ?? 5, fisico: rating?.fisico ?? 5, marcacao: rating?.marcacao ?? 5, finalizacao: rating?.finalizacao ?? 5,
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!name.trim()) return setError('Digite o nome.')
    setBusy(true)
    setError('')
    const fields: Partial<Player> = { name: name.trim(), is_goalkeeper: gk, status, birthday: birthday || null }
    if (isPresident) { fields.role = role; fields.initial_points = Number(points) || 0 }
    let id = player?.id
    if (player) {
      const { error } = await supabase.from('players').update(fields).eq('id', player.id)
      if (error) { setBusy(false); return setError(errorText(error)) }
    } else {
      const { data, error } = await supabase.from('players').insert(fields).select('id').single()
      if (error) { setBusy(false); return setError(errorText(error)) }
      id = (data as { id: string }).id
    }
    const { error: e2 } = await supabase.from('player_ratings').upsert({ player_id: id, ...r, updated_at: new Date().toISOString() })
    setBusy(false)
    if (e2) return setError(errorText(e2))
    onClose(player ? 'Membro atualizado' : 'Membro adicionado')
  }

  return (
    <div className="sheet-bg" onClick={() => onClose()}>
      <div className="sheet" role="dialog" aria-label={player ? `Editar ${player.name}` : 'Novo membro'} onClick={(e) => e.stopPropagation()}>
        <div className="between">
          <h2 className="h-l" style={{ fontSize: 24 }}>{player ? player.name : 'Novo membro'}</h2>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 26, color: 'var(--gold-text)' }}>{overall(r).toFixed(1)}</span>
        </div>
        <div className="field">
          <label htmlFor="nm">Nome ou apelido</label>
          <input id="nm" className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid2">
          <div className="field">
            <label htmlFor="st">Status</label>
            <select id="st" className="input" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
              <option value="ativo">Ativo</option><option value="afastado">Afastado</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="gk">Função</label>
            <select id="gk" className="input" value={gk ? 'gol' : 'linha'} onChange={(e) => setGk(e.target.value === 'gol')}>
              <option value="linha">Linha</option><option value="gol">Goleiro</option>
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="bd">Aniversário</label>
          <input id="bd" className="input" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
        </div>

        <div className="stack" style={{ gap: 12 }}>
          <p className="eyebrow">Notas (0 a 10)</p>
          {ATTRS.map((a) => (
            <div key={a.key} style={{ display: 'grid', gridTemplateColumns: '92px 1fr 28px', alignItems: 'center', gap: 10 }}>
              <label htmlFor={a.key} className="small muted">{a.label}</label>
              <input id={a.key} type="range" min={0} max={10} step={1} value={r[a.key]} onChange={(e) => setR({ ...r, [a.key]: Number(e.target.value) })} style={{ accentColor: 'var(--brand-blue-bright)' }} />
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, textAlign: 'right' }}>{r[a.key]}</span>
            </div>
          ))}
        </div>

        {isPresident && (
          <div className="grid2">
            <div className="field">
              <label htmlFor="rl">Permissão</label>
              <select id="rl" className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {(Object.keys(ROLE_LABEL) as Role[]).map((k) => <option key={k} value={k}>{ROLE_LABEL[k]}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="ip">Pontos iniciais</label>
              <input id="ip" className="input" inputMode="numeric" value={points} onChange={(e) => setPoints(e.target.value.replace(/\D/g, ''))} />
            </div>
          </div>
        )}
        {isPresident && player?.user_id && (
          <div className="field">
            <label htmlFor="rp">Esqueceu o PIN? Defina um novo</label>
            <div className="row">
              <input id="rp" className="input" inputMode="numeric" maxLength={4} placeholder="4 números" value={newPin} onChange={(e) => { setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setPinMsg('') }} />
              <button className="btn ghost sm" disabled={!isPin(newPin)} onClick={async () => {
                const { error } = await supabase.rpc('reset_pin', { p_player: player.id, p_pin: newPin })
                setPinMsg(error ? errorText(error) : `PIN de ${player.name} agora é ${newPin}. Avise ele!`)
                if (!error) setNewPin('')
              }}>Redefinir</button>
            </div>
            {pinMsg && <p className="small" style={{ margin: 0, color: 'var(--gold-text)' }}>{pinMsg}</p>}
          </div>
        )}
        {error && <p className="error">{error}</p>}
        <div className="row">
          <button className="btn ghost sm" style={{ flex: 1 }} onClick={() => onClose()}>Cancelar</button>
          <button className="btn gold sm" style={{ flex: 1 }} disabled={busy} onClick={save}>{busy ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}

function ClubCodeSheet({ onClose }: { onClose: (msg?: string) => void }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  useEffect(() => { supabase.rpc('get_club_code').then(({ data, error }) => error ? setError(errorText(error)) : setCode(String(data ?? ''))) }, [])
  async function save() {
    if (code.trim().length < 4) return setError('Use pelo menos 4 caracteres.')
    const { error } = await supabase.rpc('set_club_code', { code })
    if (error) return setError(errorText(error))
    onClose('Código do clube atualizado')
  }
  return (
    <div className="sheet-bg" onClick={() => onClose()}>
      <div className="sheet" role="dialog" aria-label="Código do clube" onClick={(e) => e.stopPropagation()}>
        <h2 className="h-l" style={{ fontSize: 24 }}>Código do clube</h2>
        <p className="small muted" style={{ margin: 0 }}>Quem tiver este código consegue criar conta no app. Passe só para a galera da patota.</p>
        <div className="field">
          <label htmlFor="cc">Código</label>
          <input id="cc" className="input" value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        {error && <p className="error">{error}</p>}
        <div className="row">
          <button className="btn ghost sm" style={{ flex: 1 }} onClick={() => onClose()}>Fechar</button>
          <button className="btn gold sm" style={{ flex: 1 }} onClick={save}>Salvar</button>
        </div>
      </div>
    </div>
  )
}
