import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, errorText } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Announcement, Attendance, Match, Player, Rsvp, Settings, Vote, VoteWinner } from '../lib/types'
import { isAdminRole, TEAM_LABEL, voteDeadline, votingOpen, SETTINGS_COLS, isLate, monthISO, monthName, periodLabel } from '../lib/types'
import type { CashReport, Due } from '../lib/types'
import { brl } from '../lib/pix'
import { timeLeft } from './Vote'
import { EventsHome, BirthdaysHome } from '../components/Events'
import { wrappedAvailable } from './Wrapped'
import { IS_DEMO } from '../lib/supabase'
import { Avatar, Icon, formatDate, hhmm, todayISO, useToast } from '../components/ui'
import { IMG } from '../lib/assets'

type AttWithPlayer = Attendance & { players: Pick<Player, 'id' | 'name' | 'avatar' | 'is_goalkeeper'> }

export default function Home() {
  const { player } = useAuth()
  const [next, setNext] = useState<Match | null>(null)
  const [last, setLast] = useState<Match | null>(null)
  const [att, setAtt] = useState<AttWithPlayer[]>([])
  const [notices, setNotices] = useState<Announcement[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [busy, setBusy] = useState(false)
  const [lastVotes, setLastVotes] = useState<Vote[]>([])
  const [lastPlayed, setLastPlayed] = useState<string[]>([])
  const [winners, setWinners] = useState<(VoteWinner & { name: string })[]>([])
  const [myDue, setMyDue] = useState<Due | null>(null)
  const [report, setReport] = useState<CashReport | null>(null)
  const { toast, toastNode } = useToast()

  const load = useCallback(async () => {
    const [{ data: n }, { data: l }, { data: an }, { data: st }] = await Promise.all([
      supabase.from('matches').select('*').gte('date', todayISO()).neq('status', 'encerrada').order('date').limit(1).maybeSingle(),
      supabase.from('matches').select('*').eq('status', 'encerrada').order('date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('announcements').select('*').eq('pinned', true).order('created_at', { ascending: false }).limit(3),
      supabase.from('club_settings').select(SETTINGS_COLS).maybeSingle(),
    ])
    setNext(n as Match | null)
    setLast(l as Match | null)
    setNotices((an as Announcement[]) ?? [])
    if (player) {
      await supabase.rpc('ensure_month_dues', { p_month: monthISO() })
      const { data: d } = await supabase.from('dues').select('*').eq('player_id', player.id).neq('status', 'pago').order('month').limit(1).maybeSingle()
      setMyDue((d as Due) ?? null)
      const { data: rp } = await supabase.from('cash_reports').select('*').order('published_at', { ascending: false }).limit(1).maybeSingle()
      const r = rp as CashReport | null
      setReport(r && Date.now() - new Date(r.published_at).getTime() < 7 * 86400000 ? r : null)
    }
    setSettings(st as Settings | null)
    if (l) {
      const lm = l as Match
      const [{ data: v }, { data: pa }, { data: w }, { data: ps }] = await Promise.all([
        supabase.from('votes').select('*').eq('match_id', lm.id),
        supabase.from('attendances').select('player_id,played,team').eq('match_id', lm.id),
        supabase.rpc('vote_winners'),
        supabase.from('players').select('id,name'),
      ])
      setLastVotes((v as Vote[]) ?? [])
      setLastPlayed(((pa as Attendance[]) ?? []).filter((a) => a.played && a.team).map((a) => a.player_id))
      const names = Object.fromEntries(((ps as { id: string; name: string }[]) ?? []).map((p) => [p.id, p.name]))
      setWinners(((w as VoteWinner[]) ?? []).filter((x) => x.match_id === lm.id).map((x) => ({ ...x, name: names[x.player_id] ?? '?' })))
    }
    if (n) {
      const { data: a } = await supabase.from('attendances').select('*, players(id,name,avatar,is_goalkeeper)').eq('match_id', (n as Match).id).order('rsvp_at')
      setAtt((a as AttWithPlayer[]) ?? [])
    } else setAtt([])
  }, [player])

  useEffect(() => { load() }, [load])

  const [asking, setAsking] = useState(false)

  async function rsvp(kind: Rsvp, reason?: string) {
    if (!next) return
    setBusy(true)
    setAsking(false)
    const { error } = await supabase.rpc('set_rsvp', { p_match: next.id, p_rsvp: kind, p_reason: reason ?? null })
    setBusy(false)
    if (error) return toast(errorText(error))
    toast(kind === 'vou' ? 'Presença confirmada!' : 'Beleza, fica pra próxima.')
    load()
  }

  const max = settings?.max_players ?? 12
  const going = att.filter((a) => a.rsvp === 'vou')
  const confirmed = going.slice(0, max)
  const waiting = going.slice(max)
  const mine = att.find((a) => a.player_id === player?.id)
  const myWaiting = waiting.some((a) => a.player_id === player?.id)
  const lastWinner = last && last.score_preto != null && last.score_branco != null
    ? last.score_preto === last.score_branco ? null : last.score_preto > last.score_branco ? 'preto' : 'branco'
    : null
  const hour = new Date().getHours()
  const hello = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

  return (
    <main className="screen">
      <header className="between">
        <div className="row" style={{ gap: 12 }}>
          <img src={IMG.logo} alt="Real Marditos FC" style={{ height: 46, width: "auto" }} />
          <div>
            <p className="caption muted" style={{ margin: 0 }}>{hello},</p>
            <p style={{ margin: 0, fontWeight: 600 }}>{player?.name}</p>
          </div>
        </div>
        {isAdminRole(player?.role) && (
          <Link to="/adm" className="btn sm blue" style={{ textDecoration: 'none' }}>Diretoria</Link>
        )}
      </header>

      {next ? (
        <section className="card lg stripes stack" style={{ gap: 16 }}>
          <div className="between" style={{ alignItems: 'flex-start' }}>
            <div>
              <p className="eyebrow gold">Próximo jogo</p>
              <h2 className="h-l" style={{ marginTop: 4 }}>{formatDate(next.date)}</h2>
              <p className="muted" style={{ margin: '2px 0 0' }}>{hhmm(next.starts_at)} às {hhmm(next.ends_at)} · {next.venue}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p className="stat" style={{ margin: 0 }}>{confirmed.length}<span className="muted" style={{ fontSize: 18 }}>/{max}</span></p>
              <p className="caption muted" style={{ margin: 0 }}>confirmados</p>
            </div>
          </div>

          {confirmed.length > 0 && (
            <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
              {confirmed.map((a) => (
                <Avatar key={a.player_id} avatar={a.players.avatar} seed={a.players.name} size="sm" alt={a.players.name} />
              ))}
            </div>
          )}

          {next.status === 'aberta' ? (
            <>
              <div className="row">
                <button className="btn gold pill" style={{ flex: 1 }} disabled={busy || mine?.rsvp === 'vou'} onClick={() => rsvp('vou')}>
                  {mine?.rsvp === 'vou' ? 'Confirmado' : 'Vou'}
                </button>
                <button className="btn ghost pill" style={{ flex: 1 }} disabled={busy || mine?.rsvp === 'nao_vou'} onClick={() => setAsking(true)}>
                  Não vou
                </button>
              </div>
              <p className="small muted" style={{ margin: 0 }}>
                {myWaiting
                  ? 'Você está na lista de espera. Se abrir vaga, você entra.'
                  : `Confirme até as ${hhmm(settings?.confirm_deadline ?? '14:00')} de ${formatDate(next.date).toLowerCase()}, dia do jogo. Depois desse horário, as vagas que sobrarem abrem para convidados.`}
              </p>
            </>
          ) : (
            <TeamsPosted att={att} myId={player?.id} />
          )}

          {waiting.length > 0 && next.status === 'aberta' && (
            <p className="small muted" style={{ margin: 0 }}>Lista de espera: {waiting.map((a) => a.players.name).join(', ')}</p>
          )}
          {next.status === 'aberta' && att.some((a) => a.rsvp === 'nao_vou') && (
            <p className="small muted" style={{ margin: 0 }}>
              Não vão: {att.filter((a) => a.rsvp === 'nao_vou').map((a) => a.players.name + (a.reason ? ` (${a.reason})` : '')).join(', ')}
            </p>
          )}
          {asking && <ReasonSheet busy={busy} onPick={(r) => rsvp('nao_vou', r)} onClose={() => setAsking(false)} />}
        </section>
      ) : (
        <section className="card lg stripes">
          <p className="eyebrow gold">Próximo jogo</p>
          <p style={{ margin: '6px 0 0' }}>A diretoria ainda não abriu a lista da próxima quinta.</p>
        </section>
      )}

      {myDue && settings && (myDue.month < monthISO() || new Date().getDate() >= settings.reminder_day) && (() => {
        const late = isLate(myDue, settings.due_day)
        return (
          <Link to="/caixa" className="card row" style={{ gap: 12, textDecoration: 'none', color: 'var(--ink)', border: `1px solid ${late ? 'var(--danger)' : 'var(--border)'}` }}>
            <Icon name="wallet" size={22} color={late ? 'var(--danger)' : 'var(--gold)'} />
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontWeight: 600 }}>
                {myDue.status === 'informado' ? 'Pagamento em confirmação' : late ? `Mensalidade de ${monthName(myDue.month)} atrasada` : 'O pagamento caiu? Bora acertar a patota'}
              </span>
              <span className="small muted">{brl(myDue.amount)} · {myDue.status === 'informado' ? 'o tesoureiro vai confirmar' : `vence dia ${settings.due_day} · pague pelo Pix no app`}</span>
            </span>
            <span className="small" style={{ color: 'var(--brand-blue-bright)' }}>{myDue.status === 'informado' ? 'Ver' : 'Pagar'}</span>
          </Link>
        )
      })()}

      {report && (
        <Link to="/caixa" className="card row" style={{ gap: 12, textDecoration: 'none', color: 'var(--ink)' }}>
          <Icon name="clipboard" size={22} color="var(--brand-blue-bright)" />
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontWeight: 600 }}>Prestação de contas: {periodLabel(report.month, report.period_end)}</span>
            <span className="small muted">Saldo no fim: {brl(report.closing)}</span>
          </span>
          <span className="small" style={{ color: 'var(--brand-blue-bright)' }}>Ver</span>
        </Link>
      )}

      {(wrappedAvailable() || IS_DEMO) && (
        <Link to="/retrospectiva" className="card lg stripes row" style={{ gap: 14, textDecoration: 'none', color: 'var(--brand-navy)', background: 'var(--gold)' }}>
          <img src={IMG.coroa} alt="" style={{ width: 44 }} />
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, textTransform: 'uppercase' }}>Sua retrospectiva chegou</span>
            <span className="small">Seus números do ano no Real Marditos{IS_DEMO && !wrappedAvailable() ? '. Na demo fica liberada; no app, abre em dezembro.' : ''}</span>
          </span>
        </Link>
      )}

      <BirthdaysHome />
      <EventsHome />

      {notices.map((n) => (
        <section key={n.id} className="card row" style={{ alignItems: 'flex-start', gap: 12 }}>
          <span style={{ marginTop: 1 }}><Icon name="pin" size={20} color="var(--brand-blue-bright)" /></span>
          <div>
            <p style={{ margin: 0, fontWeight: 600 }}>Aviso</p>
            <p className="muted" style={{ margin: '2px 0 0', whiteSpace: 'pre-line' }}>{n.body}</p>
          </div>
        </section>
      ))}

      {last && votingOpen(last) && (
        <section className="card lg stack" style={{ gap: 12, border: '1px solid var(--gold)' }}>
          <div className="between">
            <div>
              <p className="eyebrow gold">Votação aberta · {timeLeft(voteDeadline(last))}</p>
              <h2 className="h-title" style={{ marginTop: 4 }}>MVP e bagre da noite</h2>
            </div>
            <img src={IMG.coroa} alt="" style={{ width: 40 }} />
          </div>
          {(() => {
            const played = lastPlayed.includes(player?.id ?? '')
            const done = ['mvp', 'bagre'].every((k) => lastVotes.some((v) => v.voter_id === player?.id && v.kind === k))
            return (
              <>
                <p className="small muted" style={{ margin: 0 }}>
                  {!played ? 'Você não jogou essa, mas pode acompanhar os votos.' : done ? 'Você já votou. Dá para trocar até fechar.' : 'Você jogou: seu voto conta.'}
                  {' '}{lastVotes.length} {lastVotes.length === 1 ? 'voto' : 'votos'} até agora.
                </p>
                <Link to={`/votar/${last.id}`} className={`btn block ${played && !done ? 'gold' : 'ghost'}`} style={{ textDecoration: 'none' }}>
                  {played && !done ? 'Votar' : 'Ver votação'}
                </Link>
              </>
            )
          })()}
        </section>
      )}

      {last && (
        <section className="stack">
          <div className="between">
            <h3 className="h-title">Última noite</h3>
            <Link to="/partidas" className="small" style={{ textDecoration: 'none' }}>Ver partidas</Link>
          </div>
          <div className="card between">
            <div>
              <p className="caption muted" style={{ margin: 0 }}>{formatDate(last.date)}</p>
              <p style={{ margin: 0, fontWeight: 600 }}>
                {lastWinner ? <>{TEAM_LABEL[lastWinner]} <span style={{ color: 'var(--success)' }}>venceu</span></> : 'Empate'}
              </p>
            </div>
            <p className="stat" style={{ margin: 0 }}>{last.score_preto} <span className="muted" style={{ fontSize: 20 }}>×</span> {last.score_branco}</p>
          </div>
          {winners.length > 0 && (
            <Link to={`/votar/${last.id}`} className="card row" style={{ gap: 12, textDecoration: 'none', color: 'var(--ink)' }}>
              <img src={IMG.coroa} alt="" style={{ width: 32 }} />
              <span className="small" style={{ flex: 1 }}>
                <strong>MVP:</strong> {winners.filter((w) => w.kind === 'mvp').map((w) => w.name).join(' e ') || '—'}
                <br /><span className="muted">Bagre: {winners.filter((w) => w.kind === 'bagre').map((w) => w.name).join(' e ') || '—'}</span>
              </span>
            </Link>
          )}
          {last.photo_url && (
            <Link to="/partidas?aba=marditos" style={{ display: 'block' }}>
              <img src={last.photo_url} alt="Marditos da Noite: time vencedor" style={{ width: '100%', borderRadius: 12, display: 'block', aspectRatio: '4 / 3', objectFit: 'cover' }} />
            </Link>
          )}
        </section>
      )}
      {toastNode}
    </main>
  )
}

function TeamsPosted({ att, myId }: { att: AttWithPlayer[]; myId?: string }) {
  const mine = att.find((a) => a.player_id === myId)
  const team = (t: 'preto' | 'branco') => att.filter((a) => a.team === t)
  return (
    <div className="stack" style={{ gap: 10 }}>
      <p className="small" style={{ margin: 0 }}>
        Times postados.{' '}
        {mine?.team ? <>Você joga no <strong>{TEAM_LABEL[mine.team]}</strong>.</> : 'A lista está fechada.'}
      </p>
      <div className="grid2">
        {(['preto', 'branco'] as const).map((t) => (
          <div key={t} style={{ background: t === 'branco' ? 'var(--ink)' : 'var(--bg)', color: t === 'branco' ? 'var(--brand-navy)' : 'var(--ink)', border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
            <p className="h-title" style={{ fontSize: 16, marginBottom: 4 }}>{t === 'preto' ? 'Preto' : 'Branco'}</p>
            {team(t).map((a) => (
              <p key={a.player_id} className="small" style={{ margin: 0, lineHeight: '24px' }}>
                {a.players.name}{a.players.is_goalkeeper ? ' · GOL' : ''}
              </p>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

const REASONS = ['Trabalho', 'Faculdade', 'Lesionado', 'Doente', 'Viagem', 'Família', 'Compromisso']

/** "Não vou": motivo opcional, com atalhos e campo livre. */
function ReasonSheet({ busy, onPick, onClose }: { busy: boolean; onPick: (reason?: string) => void; onClose: () => void }) {
  const [text, setText] = useState('')
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="Motivo de não ir" onClick={(e) => e.stopPropagation()}>
        <div>
          <h2 className="h-l" style={{ fontSize: 24 }}>Vai desfalcar?</h2>
          <p className="small muted" style={{ margin: '4px 0 0' }}>Conta o motivo pra galera, se quiser. É opcional.</p>
        </div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          {REASONS.map((r) => <button key={r} type="button" className="chip" disabled={busy} onClick={() => onPick(r)}>{r}</button>)}
        </div>
        <div className="field">
          <label htmlFor="why">Outro motivo</label>
          <input id="why" className="input" maxLength={80} placeholder="Ex.: aniversário da sogra" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <button className="btn gold block" disabled={busy || !text.trim()} onClick={() => onPick(text.trim())}>Avisar com esse motivo</button>
        <button className="btn ghost block" disabled={busy} onClick={() => onPick()}>Prefiro não dizer</button>
        <button className="btn ghost block sm" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  )
}
