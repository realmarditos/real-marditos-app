import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase, errorText, isPin, pinToPassword } from '../lib/supabase'
import PinInput from '../components/PinInput'
import { useAuth } from '../lib/auth'
import type { RankingRow } from '../lib/types'
import { POSITIONS } from '../lib/types'
import { ROLE_LABEL } from '../lib/types'
import { Avatar, Icon, useToast } from '../components/ui'
import { Badges, Rivalries } from '../components/Achievements'
import { IMG } from '../lib/assets'


export default function Profile() {
  const { player, refreshPlayer, signOut } = useAuth()
  const [rank, setRank] = useState<{ pos: number; row: RankingRow } | null>(null)
  const [editing, setEditing] = useState(false)
  const [changingPin, setChangingPin] = useState(false)
  const { toast, toastNode } = useToast()

  useEffect(() => {
    supabase.rpc('ranking').then(({ data }) => {
      const rows = (data as RankingRow[]) ?? []
      const i = rows.findIndex((r) => r.player_id === player?.id)
      if (i >= 0) setRank({ pos: i + 1, row: rows[i] })
    })
  }, [player?.id])

  if (!player) return null
  const r = rank?.row
  const pct = r && r.games ? Math.round(((r.wins * 3 + r.draws) / (r.games * 3)) * 100) : null
  const details = [player.position, player.shirt_number ? `Camisa ${player.shirt_number}` : null, player.foot].filter(Boolean).join(' · ')

  return (
    <main className="screen">
      <section className="card lg stripes row" style={{ background: 'var(--brand-blue)', gap: 16, position: 'relative', overflow: 'hidden', padding: '20px 16px' }}>
        <Link to="/perfil/avatar" aria-label="Editar avatar" style={{ position: 'relative', flex: '0 0 auto' }}>
          <span style={{ display: 'block', border: '3px solid var(--gold)', borderRadius: 22 }}>
            <Avatar avatar={player.avatar} seed={player.name} size="lg" alt={`Avatar de ${player.name}`} />
          </span>
          <span style={{ position: 'absolute', right: -6, bottom: -6, width: 28, height: 28, borderRadius: 999, background: 'var(--ink)', color: 'var(--brand-navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="edit" size={14} />
          </span>
        </Link>
        <div className="stack" style={{ gap: 4 }}>
          <h1 className="h-l">{player.name}</h1>
          <p className="small" style={{ margin: 0 }}>{details || 'Complete seu perfil'}</p>
          <div className="row" style={{ gap: 6, marginTop: 4 }}>
            {rank && <span className="tag gold">{rank.pos}º no ranking</span>}
            {player.role !== 'membro' && <span className="tag soft">{ROLE_LABEL[player.role]}</span>}
          </div>
        </div>
        <img src={IMG.medalhao} alt="" aria-hidden="true" style={{ position: 'absolute', right: -24, bottom: -28, width: 120, opacity: 0.15 }} />
      </section>

      <section className="grid3">
        <Stat value={r?.points ?? '–'} label="Pontos" gold />
        <Stat value={r?.games ?? 0} label="Jogos" />
        <Stat value={r?.wins ?? 0} label="Vitórias" />
        <Stat value={r?.mvps ?? 0} label="MVPs" gold />
        <Stat value={r?.bagres ?? 0} label="Bagres" />
        <Stat value={rank ? `${rank.pos}º` : '–'} label="Ranking" />
      </section>

      <Link to="/card" className="btn blue block" style={{ textDecoration: 'none' }}>Ver meu card</Link>

      {r && r.games > 0 && (
        <section className="card stack" style={{ gap: 10 }}>
          <div className="between">
            <h2 className="h-title">Aproveitamento</h2>
            <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24, color: 'var(--gold-text)' }}>{pct}%</p>
          </div>
          <div style={{ display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden', gap: 2 }} aria-hidden="true">
            <span style={{ flex: r.wins, background: 'var(--success)' }} />
            <span style={{ flex: r.draws, background: 'var(--ink-muted)' }} />
            <span style={{ flex: r.losses, background: 'var(--danger)' }} />
          </div>
          <p className="small muted" style={{ margin: 0 }}>{r.wins} vitórias · {r.draws} empates · {r.losses} derrotas</p>
        </section>
      )}

      <Badges playerId={player.id} />
      <Rivalries playerId={player.id} self />

      {editing ? (
        <EditProfile onDone={async (msg) => { setEditing(false); if (msg) { toast(msg); await refreshPlayer() } }} />
      ) : (
        <div className="stack">
          <button className="btn ghost block sm" onClick={() => setEditing(true)}>Editar dados</button>
          {changingPin
            ? <ChangePin onDone={(msg) => { setChangingPin(false); if (msg) toast(msg) }} />
            : <button className="btn ghost block sm" onClick={() => setChangingPin(true)}>Trocar PIN</button>}
          <button className="btn ghost block sm" onClick={signOut}><Icon name="logout" size={18} />Sair</button>
        </div>
      )}
      {toastNode}
    </main>
  )
}

function Stat({ value, label, gold }: { value: number | string; label: string; gold?: boolean }) {
  return (
    <div className="card" style={{ padding: '14px 12px' }}>
      <p className="stat" style={{ margin: 0, color: gold ? 'var(--gold-text)' : 'var(--ink)' }}>{value}</p>
      <p className="caption muted" style={{ margin: 0 }}>{label}</p>
    </div>
  )
}

function EditProfile({ onDone }: { onDone: (msg?: string) => void }) {
  const { player } = useAuth()
  const [position, setPosition] = useState(player?.position ?? '')
  const [foot, setFoot] = useState(player?.foot ?? '')
  const [shirt, setShirt] = useState(player?.shirt_number?.toString() ?? '')
  const [birthday, setBirthday] = useState(player?.birthday ?? '')
  const [error, setError] = useState('')

  async function save(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase.rpc('update_my_profile', {
      p_position: position || null, p_foot: foot || null,
      p_shirt_number: shirt ? Number(shirt) : null, p_birthday: birthday || null, p_avatar: null,
    })
    if (error) return setError(errorText(error))
    onDone('Perfil atualizado')
  }

  return (
    <form className="card stack" style={{ gap: 14 }} onSubmit={save}>
      <div className="field">
        <label htmlFor="pos">Posição</label>
        <select id="pos" className="input" value={position} onChange={(e) => setPosition(e.target.value)}>
          <option value="">Escolha</option>
          {POSITIONS.map((p) => <option key={p}>{p}</option>)}
        </select>
      </div>
      <div className="grid2">
        <div className="field">
          <label htmlFor="foot">Pé</label>
          <select id="foot" className="input" value={foot} onChange={(e) => setFoot(e.target.value)}>
            <option value="">Escolha</option><option>Destro</option><option>Canhoto</option><option>Ambidestro</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="shirt">Camisa</label>
          <input id="shirt" className="input" inputMode="numeric" value={shirt} onChange={(e) => setShirt(e.target.value.replace(/\D/g, '').slice(0, 2))} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="bd">Aniversário</label>
        <input id="bd" className="input" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
      </div>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button type="button" className="btn ghost sm" style={{ flex: 1 }} onClick={() => onDone()}>Cancelar</button>
        <button className="btn gold sm" style={{ flex: 1 }}>Salvar</button>
      </div>
    </form>
  )
}

function ChangePin({ onDone }: { onDone: (msg?: string) => void }) {
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [error, setError] = useState('')
  async function save() {
    if (!isPin(pin)) return setError('O PIN precisa ter 4 números.')
    if (pin !== pin2) { setPin2(''); return setError('Os PINs não são iguais.') }
    const { error } = await supabase.auth.updateUser({ password: pinToPassword(pin) })
    if (error) return setError(errorText(error))
    onDone('PIN trocado')
  }
  return (
    <div className="card stack" style={{ gap: 14 }}>
      <PinInput id="np" label="Novo PIN" value={pin} onChange={setPin} autoFocus />
      <PinInput id="np2" label="Repita o novo PIN" value={pin2} onChange={setPin2} />
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button className="btn ghost sm" style={{ flex: 1 }} onClick={() => onDone()}>Cancelar</button>
        <button className="btn gold sm" style={{ flex: 1 }} onClick={save}>Salvar PIN</button>
      </div>
    </div>
  )
}
