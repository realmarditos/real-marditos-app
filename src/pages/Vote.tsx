import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase, errorText } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Attendance, Match, Player, Vote as VoteRow, VoteKind } from '../lib/types'
import { voteDeadline, votingOpen } from '../lib/types'
import { Avatar, Icon, formatDate, useToast } from '../components/ui'
import { IMG } from '../lib/assets'

type AttP = Attendance & { players: Pick<Player, 'id' | 'name' | 'avatar' | 'is_goalkeeper' | 'is_guest'> }

export function timeLeft(d: Date) {
  const ms = d.getTime() - Date.now()
  if (ms <= 0) return 'encerrada'
  const h = Math.floor(ms / 3600000)
  const min = Math.floor((ms % 3600000) / 60000)
  return h > 0 ? `fecha em ${h}h${min ? String(min).padStart(2, '0') : ''}` : `fecha em ${min} min`
}

const KINDS: { kind: VoteKind; title: string; hint: string }[] = [
  { kind: 'mvp', title: 'MVP da noite', hint: 'Quem jogou mais? Vale +1 ponto no ranking.' },
  { kind: 'bagre', title: 'Bagre da noite', hint: 'A zoeira oficial. Não tira ponto de ninguém.' },
]

export default function Vote() {
  const { id } = useParams()
  const { player } = useAuth()
  const [match, setMatch] = useState<Match | null>(null)
  const [att, setAtt] = useState<AttP[]>([])
  const [votes, setVotes] = useState<VoteRow[]>([])
  const [busy, setBusy] = useState(false)
  const { toast, toastNode } = useToast()

  const load = useCallback(async () => {
    const [{ data: m }, { data: a }, { data: v }] = await Promise.all([
      supabase.from('matches').select('*').eq('id', id!).maybeSingle(),
      supabase.from('attendances').select('*, players(id,name,avatar,is_goalkeeper,is_guest)').eq('match_id', id!).not('team', 'is', null),
      supabase.from('votes').select('*').eq('match_id', id!),
    ])
    setMatch(m as Match)
    setAtt(((a as AttP[]) ?? []).filter((x) => x.played))
    setVotes((v as VoteRow[]) ?? [])
  }, [id])
  useEffect(() => { load() }, [load])

  if (!match) return <main className="screen no-tabs"><p className="muted">Carregando…</p></main>

  const open = votingOpen(match)
  const iPlayed = att.some((a) => a.player_id === player?.id)
  const name = (pid: string) => att.find((a) => a.player_id === pid)?.players.name ?? '?'

  async function vote(kind: VoteKind, target: string) {
    if (!open || !iPlayed) return
    setBusy(true)
    const { error } = await supabase.rpc('cast_vote', { p_match: match!.id, p_kind: kind, p_target: target })
    setBusy(false)
    if (error) return toast(errorText(error))
    toast(kind === 'mvp' ? 'Voto de MVP registrado' : 'Voto de bagre registrado')
    load()
  }

  return (
    <main className="screen no-tabs">
      <header className="between">
        <Link to="/" aria-label="Voltar" className="btn ghost" style={{ width: 44, height: 44, padding: 0, borderRadius: 999 }}><Icon name="back" size={20} /></Link>
        <div style={{ textAlign: 'center' }}>
          <h1 className="h-l" style={{ fontSize: 24 }}>Votação</h1>
          <p className="caption muted" style={{ margin: 0 }}>{formatDate(match.date)} · {open ? timeLeft(voteDeadline(match)) : 'encerrada'}</p>
        </div>
        <span style={{ width: 44 }} />
      </header>

      {open && !iPlayed && <p className="card small" style={{ margin: 0 }}>Só quem jogou nessa noite vota. Você pode acompanhar os votos.</p>}
      {open && iPlayed && <p className="small muted" style={{ margin: 0 }}>Voto aberto: todo mundo vê quem votou em quem. Dá para trocar até a votação fechar.</p>}

      {KINDS.map(({ kind, title, hint }) => {
        const vs = votes.filter((v) => v.kind === kind)
        const count = (pid: string) => vs.filter((v) => v.target_id === pid).length
        const max = Math.max(0, ...att.map((a) => count(a.player_id)))
        const mine = vs.find((v) => v.voter_id === player?.id)?.target_id
        const sorted = [...att].sort((a, b) => count(b.player_id) - count(a.player_id) || a.players.name.localeCompare(b.players.name))
        return (
          <section key={kind} className="card lg stack" style={{ gap: 12 }}>
            <div className="between">
              <div>
                <h2 className="h-title row" style={{ gap: 8 }}>
                  {kind === 'mvp' && <img src={IMG.coroa} alt="" style={{ width: 28 }} />}{title}
                </h2>
                <p className="caption muted" style={{ margin: '2px 0 0' }}>{hint}</p>
              </div>
              <span className="caption muted">{vs.length} {vs.length === 1 ? 'voto' : 'votos'}</span>
            </div>
            <div className="stack" style={{ gap: 6 }}>
              {sorted.map((a) => {
                const n = count(a.player_id)
                const leader = n > 0 && n === max
                const selected = mine === a.player_id
                const voters = vs.filter((v) => v.target_id === a.player_id).map((v) => name(v.voter_id))
                return (
                  <button key={a.player_id} className="list-row" disabled={busy || !open || !iPlayed} onClick={() => vote(kind, a.player_id)}
                    aria-pressed={selected}
                    style={{ opacity: 1, cursor: open && iPlayed ? 'pointer' : 'default', background: selected ? 'var(--surface-raised)' : 'var(--bg)', border: selected ? `2px solid ${kind === 'mvp' ? 'var(--gold)' : 'var(--brand-blue-bright)'}` : '1px solid var(--border)' }}>
                    <Avatar avatar={a.players.avatar} seed={a.players.name} size="sm" />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 500 }}>
                        {a.players.name}
                        {a.players.is_guest && <span className="caption muted"> · convidado</span>}
                        {leader && !open && <span className="tag gold" style={{ marginLeft: 8 }}>{kind === 'mvp' ? 'MVP' : 'BAGRE'}</span>}
                      </span>
                      {voters.length > 0 && <span className="caption muted" style={{ display: 'block' }}>{voters.join(', ')}</span>}
                    </span>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, color: leader ? (kind === 'mvp' ? 'var(--gold-text)' : 'var(--brand-blue-bright)') : 'var(--ink-muted)' }}>{n}</span>
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}
      {toastNode}
    </main>
  )
}
