import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, errorText } from '../../lib/supabase'
import type { Attendance, Match, Player, Rating, Settings, Team } from '../../lib/types'
import { SETTINGS_COLS } from '../../lib/types'
import { drawTeams, overall, type DrawPlayer, type DrawResult } from '../../lib/draw'
import { AdminHeader, Icon, formatDate, hhmm, nextThursdayISO, todayISO, useToast } from '../../components/ui'

type Sep = { id: string; player_a: string; player_b: string }

export default function Game() {
  const [match, setMatch] = useState<Match | null | undefined>(undefined)
  const [players, setPlayers] = useState<Player[]>([])
  const [ratings, setRatings] = useState<Record<string, Rating>>({})
  const [att, setAtt] = useState<Attendance[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [seps, setSeps] = useState<Sep[]>([])
  const [draw, setDraw] = useState<DrawResult | null>(null)
  const [locks, setLocks] = useState<Record<string, Team>>({})
  const [busy, setBusy] = useState(false)
  const { toast, toastNode } = useToast()

  const load = useCallback(async () => {
    const [{ data: m }, { data: p }, { data: r }, { data: s }, { data: sp }] = await Promise.all([
      supabase.from('matches').select('*').gte('date', todayISO()).neq('status', 'encerrada').order('date').limit(1).maybeSingle(),
      supabase.from('players').select('*').neq('approved', false).order('name'),
      supabase.from('player_ratings').select('*'),
      supabase.from('club_settings').select(SETTINGS_COLS).maybeSingle(),
      supabase.from('draw_separations').select('*'),
    ])
    setMatch((m as Match) ?? null)
    setPlayers((p as Player[]) ?? [])
    setRatings(Object.fromEntries(((r as Rating[]) ?? []).map((x) => [x.player_id, x])))
    setSettings(s as Settings)
    setSeps((sp as Sep[]) ?? [])
    if (m) {
      const { data: a } = await supabase.from('attendances').select('*').eq('match_id', (m as Match).id).order('rsvp_at')
      setAtt((a as Attendance[]) ?? [])
    } else setAtt([])
  }, [])
  useEffect(() => { load() }, [load])

  const byId = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players])
  const max = settings?.max_players ?? 12
  const going = att.filter((a) => a.rsvp === 'vou')
  const confirmed = going.slice(0, max)
  const waiting = going.slice(max)
  const notGoing = att.filter((a) => a.rsvp === 'nao_vou')
  const noAnswer = players.filter((p) => !p.is_guest && p.status === 'ativo' && !att.some((a) => a.player_id === p.id))
  const notGoingMembers = notGoing.filter((a) => !byId[a.player_id]?.is_guest)
  const guests = players.filter((p) => p.is_guest && p.status === 'ativo')

  if (match === undefined) return <main className="screen"><AdminHeader title="Jogo" /><p className="muted">Carregando…</p></main>
  if (match === null) return <CreateMatch onCreated={(msg) => { toast(msg); load() }} toastNode={toastNode} />

  async function setRsvp(pid: string, rsvp: 'vou' | 'nao_vou') {
    const { error } = await supabase.from('attendances').upsert({ match_id: match!.id, player_id: pid, rsvp, rsvp_at: new Date().toISOString() })
    if (error) return toast(errorText(error))
    setDraw(null)
    load()
  }

  function runDraw() {
    const ps: DrawPlayer[] = confirmed.map((a) => {
      const p = byId[a.player_id]
      return { id: p.id, name: p.name, rating: overall(ratings[p.id]), isGoalkeeper: p.is_goalkeeper }
    })
    if (ps.length < 2) return toast('Precisa de pelo menos 2 confirmados.')
    setDraw(drawTeams(ps, { locks, separations: seps.map((s) => [s.player_a, s.player_b]) }))
  }

  function cycleLock(pid: string, current: Team) {
    // Toque: trava no time atual; segundo toque: manda para o outro time; terceiro: destrava
    const now = locks[pid]
    const next = { ...locks }
    if (!now) next[pid] = current
    else if (now === current) next[pid] = current === 'preto' ? 'branco' : 'preto'
    else delete next[pid]
    setLocks(next)
    if (draw) {
      const ps = [...draw.preto, ...draw.branco]
      setDraw(drawTeams(ps, { locks: next, separations: seps.map((s) => [s.player_a, s.player_b]) }))
    }
  }

  async function postTeams() {
    if (!draw || !match) return
    setBusy(true)
    const rows = [
      ...draw.preto.map((p) => ({ match_id: match.id, player_id: p.id, team: 'preto' as Team })),
      ...draw.branco.map((p) => ({ match_id: match.id, player_id: p.id, team: 'branco' as Team })),
    ]
    for (const r of rows) {
      const { error } = await supabase.from('attendances').update({ team: r.team, played: true }).eq('match_id', r.match_id).eq('player_id', r.player_id)
      if (error) { setBusy(false); return toast(errorText(error)) }
    }
    const { error } = await supabase.from('matches').update({ status: 'times_postados' }).eq('id', match.id)
    setBusy(false)
    if (error) return toast(errorText(error))
    toast('Times postados. Lista fechada.')
    setDraw(null)
    load()
  }

  async function reopen() {
    if (!match) return
    setBusy(true)
    await supabase.from('attendances').update({ team: null, played: false }).eq('match_id', match.id)
    await supabase.from('matches').update({ status: 'aberta' }).eq('id', match.id)
    setBusy(false)
    load()
  }

  const posted = match.status === 'times_postados'
  const label = (p: Player) => p.name + (p.is_goalkeeper ? ' (GOL)' : '') + (p.is_guest ? ' (convidado)' : '')
  const postedTeams = (t: Team) => att.filter((a) => a.team === t).map((a) => byId[a.player_id]).filter(Boolean)
  const shareTeams = posted
    ? { preto: postedTeams('preto').map(label), branco: postedTeams('branco').map(label) }
    : draw ? { preto: draw.preto.map((p) => label(byId[p.id])), branco: draw.branco.map((p) => label(byId[p.id])) } : null

  function whatsapp() {
    if (!shareTeams || !match) return
    const text = `⚽ *REAL MARDITOS · ${formatDate(match.date).toUpperCase()}*\n${hhmm(match.starts_at)} às ${hhmm(match.ends_at)} · ${match.venue}\n\n⚫ *TIME PRETO*\n${shareTeams.preto.join('\n')}\n\n⚪ *TIME BRANCO*\n${shareTeams.branco.join('\n')}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  return (
    <main className="screen">
      <AdminHeader title="Jogo" right={<p className="small muted" style={{ margin: '0 0 6px' }}>{formatDate(match.date)}</p>} />

      {!posted && (
        <>
          <section className="card stack">
            <div className="between">
              <h2 className="h-title">Confirmados</h2>
              <span className="stat" style={{ fontSize: 24 }}>{confirmed.length}<span className="muted" style={{ fontSize: 16 }}>/{max}</span></span>
            </div>
            {confirmed.map((a) => <PersonRow key={a.player_id} p={byId[a.player_id]} r={ratings[a.player_id]} action="Tirar" onAction={() => setRsvp(a.player_id, 'nao_vou')} />)}
            {waiting.length > 0 && <p className="eyebrow" style={{ marginTop: 8 }}>Lista de espera</p>}
            {waiting.map((a) => <PersonRow key={a.player_id} p={byId[a.player_id]} r={ratings[a.player_id]} action="Tirar" onAction={() => setRsvp(a.player_id, 'nao_vou')} />)}
          </section>

          {notGoingMembers.length > 0 && (
            <section className="card stack" style={{ gap: 6 }}>
              <h2 className="h-title">Não vão · {notGoingMembers.length}</h2>
              {notGoingMembers.map((a) => (
                <p key={a.player_id} className="small" style={{ margin: 0 }}>
                  <strong>{byId[a.player_id]?.name ?? '?'}</strong>{' '}<span className="muted">{a.reason ?? 'sem motivo'}</span>
                </p>
              ))}
            </section>
          )}

          {(noAnswer.length > 0 || notGoingMembers.length > 0) && (
            <details className="card">
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Adicionar membro na lista · {noAnswer.length} sem resposta, {notGoingMembers.length} não vão</summary>
              <div className="stack" style={{ marginTop: 10 }}>
                {[...noAnswer, ...notGoingMembers.map((a) => byId[a.player_id])].filter(Boolean).map((p) => (
                  <PersonRow key={p.id} p={p} r={ratings[p.id]} action="Colocar" onAction={() => setRsvp(p.id, 'vou')} />
                ))}
              </div>
            </details>
          )}

          <Guests guests={guests} ratings={ratings} going={going.map((a) => a.player_id)} onToggle={(id, on) => setRsvp(id, on ? 'vou' : 'nao_vou')} onChange={load} matchId={match.id} toast={toast} />

          <Separations players={players.filter((p) => !p.is_guest)} seps={seps} onChange={load} />

          {draw ? (
            <DrawView draw={draw} locks={locks} onTap={cycleLock} />
          ) : (
            <p className="small muted" style={{ margin: 0 }}>Quando a lista estiver pronta, sorteie os times. Os {max} primeiros confirmados entram.</p>
          )}

          <div className="stack">
            {draw && <button className="btn gold block" disabled={busy} onClick={postTeams}>Postar times e fechar lista</button>}
            <div className="row">
              <button className="btn ghost sm" style={{ flex: 1 }} onClick={runDraw}><Icon name="shuffle" size={18} />{draw ? 'Sortear de novo' : 'Sortear times'}</button>
              {draw && <button className="btn ghost sm" style={{ flex: 1 }} onClick={whatsapp}><Icon name="whatsapp" size={18} />WhatsApp</button>}
            </div>
            {draw && <p className="caption muted" style={{ margin: 0 }}>Toque num jogador para travar no time. Toque de novo para trocar de lado, e mais uma vez para destravar.</p>}
          </div>
        </>
      )}

      {posted && (
        <>
          <section className="grid2">
            {(['preto', 'branco'] as Team[]).map((t) => (
              <TeamCard key={t} team={t} names={postedTeams(t).map((p) => p.name + (p.is_goalkeeper ? ' · GOL' : '') + (p.is_guest ? ' · convidado' : ''))} />
            ))}
          </section>
          <Link to="/adm/sumula" className="btn gold block" style={{ textDecoration: 'none' }}>Ir para a súmula</Link>
          <div className="row">
            <button className="btn ghost sm" style={{ flex: 1 }} onClick={whatsapp}><Icon name="whatsapp" size={18} />WhatsApp</button>
            <button className="btn ghost sm" style={{ flex: 1 }} disabled={busy} onClick={reopen}>Reabrir lista</button>
          </div>
        </>
      )}
      {toastNode}
    </main>
  )
}

function PersonRow({ p, r, action, onAction }: { p?: Player; r?: Rating; action: string; onAction: () => void }) {
  if (!p) return null
  return (
    <div className="between" style={{ minHeight: 40 }}>
      <span>{p.name}{p.is_goalkeeper ? <span className="caption muted"> · GOL</span> : null}{p.is_guest ? <span className="caption gold-text"> · convidado</span> : null}</span>
      <span className="row" style={{ gap: 12 }}>
        <span className="small muted" style={{ fontFamily: 'var(--font-display)' }}>{overall(r).toFixed(1)}</span>
        <button className="btn ghost sm" style={{ height: 32, padding: '0 10px', fontSize: 13 }} onClick={onAction}>{action}</button>
      </span>
    </div>
  )
}

function TeamCard({ team, names, avg }: { team: Team; names: string[]; avg?: number }) {
  const light = team === 'branco'
  return (
    <div style={{ background: light ? 'var(--ink)' : 'var(--bg)', color: light ? 'var(--brand-navy)' : 'var(--ink)', border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
      <div className="between" style={{ marginBottom: 4 }}>
        <h3 className="h-title" style={{ fontSize: 18 }}>{light ? 'Branco' : 'Preto'}</h3>
        {avg != null && <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20 }}>{avg.toFixed(1)}</span>}
      </div>
      {names.map((n) => <p key={n} className="small" style={{ margin: 0, lineHeight: '26px' }}>{n}</p>)}
    </div>
  )
}

function DrawView({ draw, locks, onTap }: { draw: DrawResult; locks: Record<string, Team>; onTap: (id: string, t: Team) => void }) {
  const balanced = draw.diff <= 0.3
  return (
    <section className="stack">
      <div className="card stack" style={{ padding: '12px 14px' }}>
        <div className="between">
          <p style={{ margin: 0, fontWeight: 600 }} className="small">Equilíbrio</p>
          <p className="small" style={{ margin: 0, fontWeight: 600, color: balanced ? 'var(--success)' : 'var(--gold-text)' }}>
            Diferença de {draw.diff.toFixed(1)} · {balanced ? 'Equilibrado' : 'Dá pra melhorar'}
          </p>
        </div>
        <div style={{ display: 'flex', height: 8, borderRadius: 999, overflow: 'hidden', gap: 2 }} aria-hidden="true">
          <span style={{ flex: draw.avgPreto, background: '#5A6480' }} /><span style={{ flex: draw.avgBranco, background: 'var(--ink)' }} />
        </div>
        {draw.violations > 0 && <p className="caption" style={{ margin: 0, color: 'var(--danger)' }}>Não deu para separar todas as duplas com esses confirmados.</p>}
      </div>
      <div className="grid2">
        {(['preto', 'branco'] as Team[]).map((t) => {
          const light = t === 'branco'
          const list = t === 'preto' ? draw.preto : draw.branco
          return (
            <div key={t} style={{ background: light ? 'var(--ink)' : 'var(--bg)', color: light ? 'var(--brand-navy)' : 'var(--ink)', border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
              <div className="between" style={{ marginBottom: 4 }}>
                <h3 className="h-title" style={{ fontSize: 18 }}>{light ? 'Branco' : 'Preto'}</h3>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20 }}>{(t === 'preto' ? draw.avgPreto : draw.avgBranco).toFixed(1)}</span>
              </div>
              {list.map((p) => (
                <button key={p.id} onClick={() => onTap(p.id, t)}
                  style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 0, padding: 0, color: 'inherit', fontSize: 14, lineHeight: '28px', textAlign: 'left' }}>
                  <span className="row" style={{ gap: 4 }}>
                    {locks[p.id] && <Icon name="lock" size={12} />}
                    {p.name}{p.isGoalkeeper ? ' · GOL' : ''}
                  </span>
                  <span style={{ fontFamily: 'var(--font-display)', opacity: 0.7 }}>{p.rating.toFixed(1)}</span>
                </button>
              ))}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function Guests({ guests, ratings, going, onToggle, onChange, matchId, toast }: {
  guests: Player[]; ratings: Record<string, Rating>; going: string[]; matchId: string
  onToggle: (id: string, on: boolean) => void; onChange: () => void; toast: (m: string) => void
}) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [gk, setGk] = useState(false)
  const [nota, setNota] = useState(6)
  const [busy, setBusy] = useState(false)

  async function create(putInGame: boolean) {
    if (!name.trim()) return toast('Digite o nome do convidado.')
    setBusy(true)
    const { data, error } = await supabase.from('players')
      .insert({ name: name.trim(), is_guest: true, is_goalkeeper: gk, position: gk ? 'Goleiro' : null })
      .select('id').single()
    if (error) { setBusy(false); return toast(errorText(error)) }
    const id = (data as { id: string }).id
    await supabase.from('player_ratings').upsert({ player_id: id, tecnica: nota, fisico: nota, marcacao: nota, finalizacao: nota })
    if (putInGame) await supabase.from('attendances').upsert({ match_id: matchId, player_id: id, rsvp: 'vou', rsvp_at: new Date().toISOString() })
    setBusy(false)
    setName(''); setGk(false); setNota(6); setAdding(false)
    toast(putInGame ? 'Convidado salvo e colocado no jogo' : 'Convidado salvo')
    onChange()
  }

  async function removeSaved(p: Player) {
    // Sai da lista de convidados, mas continua no histórico das partidas
    await supabase.from('players').update({ status: 'afastado' }).eq('id', p.id)
    if (going.includes(p.id)) onToggle(p.id, false)
    else onChange()
  }

  return (
    <section className="card stack">
      <div className="between">
        <h2 className="h-title">Convidados</h2>
        {!adding && <button className="btn blue sm" style={{ height: 36 }} onClick={() => setAdding(true)}>+ Convidado</button>}
      </div>
      {guests.length === 0 && !adding && <p className="small muted" style={{ margin: 0 }}>Nenhum convidado salvo. Quem você adicionar fica guardado aqui para as próximas quintas.</p>}
      {guests.map((p) => {
        const inGame = going.includes(p.id)
        return (
          <div key={p.id} className="between" style={{ minHeight: 40 }}>
            <span>{p.name}{p.is_goalkeeper ? <span className="caption muted"> · GOL</span> : null}</span>
            <span className="row" style={{ gap: 8 }}>
              <span className="small muted" style={{ fontFamily: 'var(--font-display)' }}>{overall(ratings[p.id]).toFixed(1)}</span>
              <button className="btn ghost sm" style={{ height: 32, padding: '0 10px', fontSize: 13 }} onClick={() => onToggle(p.id, !inGame)}>{inGame ? 'Tirar' : 'Colocar'}</button>
              <button className="btn ghost sm" aria-label={`Remover ${p.name} dos convidados`} style={{ height: 32, width: 32, padding: 0, fontSize: 16 }} onClick={() => removeSaved(p)}>×</button>
            </span>
          </div>
        )
      })}
      {adding && (
        <div className="stack" style={{ gap: 12, borderTop: guests.length ? '1px solid var(--border)' : 0, paddingTop: guests.length ? 12 : 0 }}>
          <div className="field">
            <label htmlFor="gname">Nome do convidado</label>
            <input id="gname" className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="grid2">
            <div className="field">
              <label htmlFor="gfn">Função</label>
              <select id="gfn" className="input" value={gk ? 'gol' : 'linha'} onChange={(e) => setGk(e.target.value === 'gol')}>
                <option value="linha">Linha</option><option value="gol">Goleiro</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="gnota">Nota · {nota}</label>
              <input id="gnota" type="range" min={0} max={10} step={1} value={nota} onChange={(e) => setNota(Number(e.target.value))} style={{ height: 52, accentColor: 'var(--brand-blue-bright)' }} />
            </div>
          </div>
          <p className="caption muted" style={{ margin: 0 }}>A nota entra no sorteio. Convidado não soma pontos no ranking.</p>
          <button className="btn blue block sm" disabled={busy} onClick={() => create(true)}>Salvar e colocar no jogo</button>
          <div className="row">
            <button className="btn ghost sm" style={{ flex: 1 }} onClick={() => setAdding(false)}>Cancelar</button>
            <button className="btn ghost sm" style={{ flex: 1 }} disabled={busy} onClick={() => create(false)}>Só salvar</button>
          </div>
        </div>
      )}
    </section>
  )
}

function Separations({ players, seps, onChange }: { players: Player[]; seps: Sep[]; onChange: () => void }) {
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const name = (id: string) => players.find((p) => p.id === id)?.name ?? '?'
  async function add() {
    if (!a || !b || a === b) return
    await supabase.from('draw_separations').insert({ player_a: a, player_b: b })
    setA(''); setB(''); onChange()
  }
  async function remove(id: string) {
    await supabase.from('draw_separations').delete().eq('id', id)
    onChange()
  }
  return (
    <details className="card">
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Duplas separadas · {seps.length}</summary>
      <div className="stack" style={{ marginTop: 10 }}>
        {seps.map((s) => (
          <div key={s.id} className="between">
            <span className="small">{name(s.player_a)} e {name(s.player_b)}</span>
            <button className="btn ghost sm" style={{ height: 32, padding: '0 10px', fontSize: 13 }} onClick={() => remove(s.id)}>Remover</button>
          </div>
        ))}
        <div className="grid2">
          <select className="input" aria-label="Jogador A" value={a} onChange={(e) => setA(e.target.value)}>
            <option value="">Jogador</option>{players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="input" aria-label="Jogador B" value={b} onChange={(e) => setB(e.target.value)}>
            <option value="">Jogador</option>{players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <button className="btn ghost sm" onClick={add}>Separar essa dupla</button>
      </div>
    </details>
  )
}

function CreateMatch({ onCreated, toastNode }: { onCreated: (msg: string) => void; toastNode: React.ReactNode }) {
  const [date, setDate] = useState(nextThursdayISO())
  const [venue, setVenue] = useState('Lince Arena')
  const [start, setStart] = useState('19:00')
  const [end, setEnd] = useState('20:00')
  const [error, setError] = useState('')
  async function create() {
    const { error } = await supabase.from('matches').insert({ date, venue, starts_at: start, ends_at: end })
    if (error) return setError(error.message.includes('duplicate') ? 'Já existe um jogo nessa data.' : errorText(error))
    onCreated('Lista aberta! A galera já pode confirmar.')
  }
  return (
    <main className="screen">
      <AdminHeader title="Jogo" />
      <section className="card stack" style={{ gap: 14 }}>
        <h2 className="h-title">Abrir a lista da próxima quinta</h2>
        <div className="field"><label htmlFor="dt">Data</label><input id="dt" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="grid2">
          <div className="field"><label htmlFor="hs">Início</label><input id="hs" className="input" type="time" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div className="field"><label htmlFor="he">Fim</label><input id="he" className="input" type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
        </div>
        <div className="field"><label htmlFor="vn">Local</label><input id="vn" className="input" value={venue} onChange={(e) => setVenue(e.target.value)} /></div>
        {error && <p className="error">{error}</p>}
        <button className="btn gold block" onClick={create}>Abrir lista</button>
      </section>
      {toastNode}
    </main>
  )
}
