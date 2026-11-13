import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Attendance, Match, Player, VoteWinner } from '../lib/types'
import { TEAM_LABEL, votingOpen, canManageGame } from '../lib/types'
import { useAuth } from '../lib/auth'
import { errorText } from '../lib/supabase'
import { formatDate, RoleTag } from '../components/ui'
import { IMG } from '../lib/assets'
import MatchFeed from '../components/MatchFeed'
import ShareArt from '../components/ShareArt'
import { MatchArt } from '../components/Arts'

type AttP = Attendance & { players: Pick<Player, 'name' | 'is_goalkeeper' | 'is_guest'> & { role?: string | null } }

function winnerTeam(m: Match) {
  if (m.score_preto == null || m.score_branco == null || m.score_preto === m.score_branco) return null
  return m.score_preto > m.score_branco ? 'preto' : 'branco'
}
function winnerText(m: Match) {
  if (m.score_preto == null || m.score_branco == null) return '—'
  const w = winnerTeam(m)
  return w ? `${TEAM_LABEL[w]} venceu` : 'Empate'
}

export default function Matches() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('aba') === 'marditos' ? 'marditos' : 'partidas'
  const [matches, setMatches] = useState<Match[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [lineups, setLineups] = useState<Record<string, AttP[]>>({})
  const [winners, setWinners] = useState<VoteWinner[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [plist, setPlist] = useState<Record<string, Pick<Player, 'id' | 'name' | 'avatar'>>>({})
  const [zoom, setZoom] = useState<Match | null>(null)
  const [awarding, setAwarding] = useState<Match | null>(null)
  const [sharing, setSharing] = useState<Match | null>(null)
  const { player: me } = useAuth()
  const reloadWinners = () => supabase.rpc('vote_winners').then(({ data }) => setWinners((data as VoteWinner[]) ?? []))

  useEffect(() => {
    Promise.all([
      supabase.from('matches').select('*').eq('status', 'encerrada').order('date', { ascending: false }).limit(60),
      supabase.rpc('vote_winners'),
      supabase.from('players').select('id,name,avatar'),
    ]).then(([{ data }, { data: w }, { data: ps }]) => {
      const ms = (data as Match[]) ?? []
      setMatches(ms)
      setWinners((w as VoteWinner[]) ?? [])
      setNames(Object.fromEntries(((ps as { id: string; name: string }[]) ?? []).map((p) => [p.id, p.name])))
      setPlist(Object.fromEntries(((ps as Player[]) ?? []).map((p) => [p.id, p])))
      if (ms[0]) toggle(ms[0].id)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function toggle(id: string) {
    setOpen((o) => (o === id ? null : id))
    if (!lineups[id]) {
      const { data } = await supabase.from('attendances').select('*, players(name,is_goalkeeper,is_guest,role)').eq('match_id', id).not('team', 'is', null)
      setLineups((l) => ({ ...l, [id]: (data as AttP[]) ?? [] }))
    }
  }

  const award = (mid: string, kind: 'mvp' | 'bagre') => winners.filter((w) => w.match_id === mid && w.kind === kind).map((w) => names[w.player_id]).join(' e ')
  const photos = (matches ?? []).filter((m) => m.photo_url)

  return (
    <main className="screen">
      <header>
        <p className="eyebrow">Histórico</p>
        <h1 className="h-xl" style={{ marginTop: 2 }}>{tab === 'marditos' ? 'Marditos da Noite' : 'Partidas'}</h1>
      </header>
      <div className="row" role="tablist">
        <button role="tab" aria-selected={tab === 'partidas'} className={`chip ${tab === 'partidas' ? 'on' : ''}`} onClick={() => setParams({})}>Partidas</button>
        <button role="tab" aria-selected={tab === 'marditos'} className={`chip ${tab === 'marditos' ? 'on' : ''}`} onClick={() => setParams({ aba: 'marditos' })}>Marditos da Noite</button>
      </div>

      {tab === 'marditos' && (
        <>
          {matches && photos.length === 0 && <p className="muted">Ainda não tem foto. Depois da súmula, a diretoria posta a foto do time vencedor e ela aparece aqui.</p>}
          <div className="grid2">
            {photos.map((m) => {
              const w = winnerTeam(m)
              return (
                <button key={m.id} onClick={() => setZoom(m)} style={{ padding: 0, border: 0, background: 'var(--surface)', borderRadius: 12, overflow: 'hidden', textAlign: 'left', color: 'var(--ink)' }}>
                  <img src={m.photo_url!} alt={`Vencedores de ${formatDate(m.date, false)}`} style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', display: 'block' }} />
                  <span style={{ display: 'block', padding: '8px 10px' }}>
                    <span className="caption muted" style={{ display: 'block' }}>{formatDate(m.date, false)} · {m.score_preto} × {m.score_branco}</span>
                    <span className="small" style={{ fontWeight: 600 }}>{w ? TEAM_LABEL[w] : 'Empate'}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}

      {tab === 'partidas' && (
        <>
          {matches && matches.length === 0 && <p className="muted">Nenhuma partida encerrada ainda. Depois da primeira súmula, ela aparece aqui.</p>}
          {matches?.map((m) => {
            const isOpen = open === m.id
            const lu = lineups[m.id] ?? []
            const mvp = award(m.id, 'mvp')
            const bagre = award(m.id, 'bagre')
            return (
              <article key={m.id} className={`card ${isOpen ? 'lg' : ''}`} style={{ padding: 0, overflow: 'hidden' }}>
                <button type="button" onClick={() => toggle(m.id)} aria-expanded={isOpen}
                  style={{ width: '100%', background: 'none', border: 0, color: 'inherit', padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left' }}>
                  <div>
                    <p className="caption muted" style={{ margin: 0 }}>{formatDate(m.date)}</p>
                    <p style={{ margin: 0, fontWeight: 500 }}>{winnerText(m)}</p>
                    {mvp && <p className="caption gold-text" style={{ margin: 0, fontWeight: 600 }}>MVP {mvp}</p>}
                  </div>
                  <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24 }}>{m.score_preto} × {m.score_branco}</p>
                </button>
                {isOpen && (
                  <>
                    {m.photo_url && <img src={m.photo_url} alt="Time vencedor" style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', display: 'block' }} />}
                    <div className="grid2" style={{ gap: 16, borderTop: '1px solid var(--border)', padding: '12px 16px' }}>
                      {(['preto', 'branco'] as const).map((t) => (
                        <div key={t}>
                          <p className="row caption muted" style={{ margin: '0 0 4px', gap: 6 }}>
                            <span style={{ width: 12, height: 12, borderRadius: 999, background: t === 'preto' ? 'var(--bg)' : 'var(--ink)', border: '2px solid var(--ink)' }} />
                            {TEAM_LABEL[t].toUpperCase()}
                          </p>
                          {lu.filter((a) => a.team === t).map((a) => (
                            <p key={a.player_id} className="small" style={{ margin: 0, lineHeight: '22px', color: a.played ? 'var(--ink)' : 'var(--ink-muted)' }}>
                              {a.players.name} <RoleTag role={a.players.role} />{a.players.is_goalkeeper ? ' · GOL' : ''}{a.players.is_guest ? ' · convidado' : ''}
                            </p>
                          ))}
                        </div>
                      ))}
                    </div>
                    {m.score_preto != null && m.score_branco != null && (
                      <button type="button" className="btn gold sm" style={{ margin: '0 16px 12px', width: 'calc(100% - 32px)' }} onClick={() => setSharing(m)}>
                        Compartilhar resultado
                      </button>
                    )}
                    <Link to={`/votar/${m.id}`} className="between small" style={{ borderTop: '1px solid var(--border)', padding: '12px 16px', textDecoration: 'none', color: 'var(--ink)' }}>
                      <span className="row" style={{ gap: 8 }}>
                        <img src={IMG.coroa} alt="" style={{ width: 22 }} />
                        {votingOpen(m) ? 'Votação aberta' : mvp || bagre ? <>MVP {mvp || '—'} <span className="muted">· Bagre {bagre || '—'}</span></> : 'Sem votos'}
                      </span>
                      <span style={{ color: 'var(--brand-blue-bright)' }}>Ver votação</span>
                    </Link>
                    {canManageGame(me?.role) && !votingOpen(m) && (['mvp', 'bagre'] as const).some((k) => !winners.some((w) => w.match_id === m.id && w.kind === k && w.votes > 0)) && (
                      <button type="button" className="btn ghost sm" style={{ margin: '0 16px 12px', width: 'calc(100% - 32px)' }} onClick={() => setAwarding(m)}>
                        Ninguém votou? A diretoria define MVP e bagre
                      </button>
                    )}
                    <MatchFeed matchId={m.id} players={plist} />
                  </>
                )}
              </article>
            )
          })}
        </>
      )}

      {zoom && (
        <div className="sheet-bg" style={{ alignItems: 'center' }} onClick={() => setZoom(null)}>
          <figure style={{ margin: 16, maxWidth: 480, width: '100%' }}>
            <img src={zoom.photo_url!} alt="Time vencedor" style={{ width: '100%', borderRadius: 12, display: 'block' }} />
            <figcaption className="small" style={{ marginTop: 8, textAlign: 'center' }}>
              {formatDate(zoom.date)} · {winnerText(zoom)} · {zoom.score_preto} × {zoom.score_branco}
              {award(zoom.id, 'mvp') && <> · MVP {award(zoom.id, 'mvp')}</>}
            </figcaption>
          </figure>
        </div>
      )}
      {sharing && (() => {
        const lu = (lineups[sharing.id] ?? []).filter((a) => a.played)
        const side = (t: 'preto' | 'branco') => lu.filter((a) => a.team === t).map((a) => ({
          id: a.player_id, name: a.players.name, avatar: plist[a.player_id]?.avatar, gk: a.players.is_goalkeeper, guest: a.players.is_guest,
        }))
        return (
          <ShareArt title="Resultado para o grupo" file={`marditos-${sharing.date}`} text={`Real Marditos · ${formatDate(sharing.date)}`} onClose={() => setSharing(null)}>
            <MatchArt date={sharing.date} venue={sharing.venue} preto={side('preto')} branco={side('branco')}
              scorePreto={sharing.score_preto!} scoreBranco={sharing.score_branco!} photo={sharing.photo_url} mvp={award(sharing.id, 'mvp') || undefined} />
          </ShareArt>
        )
      })()}
      {awarding && (
        <AwardSheet match={awarding} lineup={(lineups[awarding.id] ?? []).filter((a) => a.played)} winners={winners.filter((w) => w.match_id === awarding.id)}
          onClose={async (saved) => { setAwarding(null); if (saved) await reloadWinners() }} />
      )}
    </main>
  )
}

/** A diretoria escolhe MVP e bagre de uma partida em que ninguém votou. Votação sempre vale primeiro. */
function AwardSheet({ match, lineup, winners, onClose }: { match: Match; lineup: AttP[]; winners: VoteWinner[]; onClose: (saved: boolean) => void }) {
  const kinds = (['mvp', 'bagre'] as const).filter((k) => !winners.some((w) => w.kind === k && w.votes > 0))
  const [pick, setPick] = useState<Record<'mvp' | 'bagre', string[]>>({
    mvp: winners.filter((w) => w.kind === 'mvp' && w.votes === 0).map((w) => w.player_id),
    bagre: winners.filter((w) => w.kind === 'bagre' && w.votes === 0).map((w) => w.player_id),
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const toggle = (k: 'mvp' | 'bagre', id: string) => setPick((p) => ({ ...p, [k]: p[k].includes(id) ? p[k].filter((x) => x !== id) : [...p[k], id] }))

  async function save() {
    setBusy(true)
    for (const k of kinds) {
      const { error } = await supabase.rpc('set_match_award', { p_match: match.id, p_kind: k, p_players: pick[k] })
      if (error) { setBusy(false); return setError(errorText(error)) }
    }
    setBusy(false)
    onClose(true)
  }

  return (
    <div className="sheet-bg" onClick={() => onClose(false)}>
      <div className="sheet" role="dialog" aria-label="Definir MVP e bagre" onClick={(e) => e.stopPropagation()}>
        <h2 className="h-l" style={{ fontSize: 24 }}>MVP e bagre da diretoria</h2>
        <p className="small muted" style={{ margin: 0 }}>{formatDate(match.date)}. Vale só para o prêmio em que ninguém votou. Se a galera votar, a votação manda.</p>
        {lineup.length === 0 && <p className="small muted">Ninguém marcado como "jogou" na súmula dessa partida.</p>}
        {kinds.map((k) => (
          <div key={k} className="stack" style={{ gap: 8 }}>
            <p className="eyebrow gold" style={{ margin: 0 }}>{k === 'mvp' ? 'MVP' : 'Bagre'}</p>
            <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
              {lineup.filter((a) => !a.players.is_guest).map((a) => (
                <button key={a.player_id} type="button" className={`chip ${pick[k].includes(a.player_id) ? 'on' : ''}`} onClick={() => toggle(k, a.player_id)}>{a.players.name}</button>
              ))}
            </div>
          </div>
        ))}
        {error && <p className="small" style={{ color: 'var(--danger)', margin: 0 }}>{error}</p>}
        <button className="btn gold block" disabled={busy} onClick={save}>{busy ? 'Salvando…' : 'Salvar'}</button>
        <button className="btn ghost block sm" onClick={() => onClose(false)}>Cancelar</button>
      </div>
    </div>
  )
}
