import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, errorText } from '../../lib/supabase'
import type { Attendance, Match, Player, Settings, Team } from '../../lib/types'
import { SETTINGS_COLS } from '../../lib/types'
import { AdminHeader, formatDate, useToast } from '../../components/ui'
import { uploadMatchPhoto } from '../../lib/photos'

type AttP = Attendance & { players: Pick<Player, 'name' | 'is_goalkeeper' | 'is_guest'> }

export default function Sumula() {
  const [match, setMatch] = useState<Match | null | undefined>(undefined)
  const [recent, setRecent] = useState<Match[]>([])
  const [att, setAtt] = useState<AttP[]>([])
  const [played, setPlayed] = useState<Record<string, boolean>>({})
  const [score, setScore] = useState({ preto: 0, branco: 0 })
  const [settings, setSettings] = useState<Settings | null>(null)
  const [busy, setBusy] = useState(false)
  const { toast, toastNode } = useToast()

  const open = useCallback(async (m: Match | null) => {
    setMatch(m)
    if (!m) return
    setScore({ preto: m.score_preto ?? 0, branco: m.score_branco ?? 0 })
    const { data } = await supabase.from('attendances').select('*, players(name,is_goalkeeper,is_guest)').eq('match_id', m.id).not('team', 'is', null)
    const rows = (data as AttP[]) ?? []
    setAtt(rows)
    setPlayed(Object.fromEntries(rows.map((a) => [a.player_id, a.played])))
  }, [])

  const load = useCallback(async (keepId?: string) => {
    const [{ data: m }, { data: r }, { data: s }] = await Promise.all([
      supabase.from('matches').select('*').eq('status', 'times_postados').order('date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('matches').select('*').eq('status', 'encerrada').order('date', { ascending: false }).limit(3),
      supabase.from('club_settings').select(SETTINGS_COLS).maybeSingle(),
    ])
    setRecent((r as Match[]) ?? [])
    setSettings(s as Settings)
    if (keepId) {
      const { data: k } = await supabase.from('matches').select('*').eq('id', keepId).maybeSingle()
      open((k as Match) ?? null)
    } else open((m as Match) ?? null)
  }, [open])
  useEffect(() => { load() }, [load])

  async function onPhoto(file?: File) {
    if (!file || !match) return
    setBusy(true)
    try {
      const url = await uploadMatchPhoto(match.id, file)
      const { error } = await supabase.from('matches').update({ photo_url: url }).eq('id', match.id)
      if (error) throw error
      setMatch({ ...match, photo_url: url })
      toast('Foto publicada no Marditos da Noite')
    } catch (e) {
      toast(errorText(e))
    }
    setBusy(false)
  }

  async function save() {
    if (!match) return
    setBusy(true)
    for (const a of att) {
      if (a.played !== played[a.player_id]) {
        const { error } = await supabase.from('attendances').update({ played: played[a.player_id] }).eq('match_id', match.id).eq('player_id', a.player_id)
        if (error) { setBusy(false); return toast(errorText(error)) }
      }
    }
    const { error } = await supabase.from('matches').update({ score_preto: score.preto, score_branco: score.branco, status: 'encerrada' }).eq('id', match.id)
    setBusy(false)
    if (error) return toast(errorText(error))
    toast(match.status === 'encerrada' ? 'Súmula corrigida' : 'Súmula lançada. Votação aberta!')
    load(match.id)
  }

  if (match === undefined) return <main className="screen"><AdminHeader title="Súmula" /><p className="muted">Carregando…</p></main>

  const s = settings ?? { pts_win: 3, pts_draw: 1, pts_loss: 0, pts_presence: 1 } as Settings
  const result = score.preto === score.branco ? 'E' : score.preto > score.branco ? 'preto' : 'branco'
  const pts = (t: Team) => s.pts_presence + (result === 'E' ? s.pts_draw : result === t ? s.pts_win : s.pts_loss)
  const why = (t: Team) => (result === 'E' ? 'empate + presença' : result === t ? 'vitória + presença' : 'presença')

  return (
    <main className="screen">
      <AdminHeader title="Súmula" right={match ? <p className="small muted" style={{ margin: '0 0 6px' }}>{formatDate(match.date)}</p> : undefined} />

      {!match && (
        <section className="card stack">
          <p style={{ margin: 0 }}>Nenhum jogo com times postados esperando súmula.</p>
          <Link to="/adm/jogo" className="small">Ir para o jogo</Link>
        </section>
      )}

      {match && (
        <>
          {match.status === 'encerrada' && <p className="small gold-text" style={{ margin: 0 }}>Corrigindo a súmula de {formatDate(match.date)}. Salvar recalcula o ranking.</p>}
          <section className="card lg grid2" style={{ gap: 12 }}>
            {(['preto', 'branco'] as Team[]).map((t) => (
              <div key={t} className="stack" style={{ alignItems: 'center' }}>
                <label htmlFor={`g-${t}`} className="h-title" style={{ fontSize: 16 }}>Time {t === 'preto' ? 'Preto' : 'Branco'}</label>
                <div className="row" style={{ gap: 10 }}>
                  <button className="btn ghost" style={{ width: 44, height: 44, padding: 0, borderRadius: 999, fontSize: 22 }} aria-label={`Menos um gol do ${t}`}
                    onClick={() => setScore({ ...score, [t]: Math.max(0, score[t] - 1) })}>−</button>
                  <input id={`g-${t}`} inputMode="numeric" value={score[t]} onChange={(e) => setScore({ ...score, [t]: Number(e.target.value.replace(/\D/g, '')) || 0 })}
                    style={{ width: 64, height: 64, textAlign: 'center', border: 0, borderRadius: 12, background: 'var(--surface-raised)', color: 'var(--ink)', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 40 }} />
                  <button className="btn ghost" style={{ width: 44, height: 44, padding: 0, borderRadius: 999, fontSize: 22 }} aria-label={`Mais um gol do ${t}`}
                    onClick={() => setScore({ ...score, [t]: score[t] + 1 })}>+</button>
                </div>
              </div>
            ))}
          </section>

          <section className="card stack">
            <h2 className="h-title" style={{ fontSize: 18 }}>Pontos desta noite</h2>
            {(['preto', 'branco'] as Team[]).map((t) => (
              <div key={t} className="between small">
                <span>Time {t === 'preto' ? 'Preto' : 'Branco'} <span className="muted">· {why(t)}</span></span>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--gold-text)' }}>+{pts(t)} cada</span>
              </div>
            ))}
            <p className="caption muted" style={{ margin: 0 }}>Quem não jogou não leva ponto. O ponto do MVP entra quando a votação fechar, 24h depois do jogo.</p>
          </section>

          <section className="card stack" style={{ gap: 4 }}>
            <h2 className="h-title" style={{ fontSize: 18, marginBottom: 6 }}>Quem jogou</h2>
            {att.map((a) => (
              <label key={a.player_id} className="row" style={{ gap: 12, minHeight: 40 }}>
                <input type="checkbox" checked={!!played[a.player_id]} onChange={(e) => setPlayed({ ...played, [a.player_id]: e.target.checked })} style={{ width: 20, height: 20, accentColor: 'var(--gold)' }} />
                <span style={{ flex: 1 }}>{a.players.name}{a.players.is_goalkeeper ? ' · GOL' : ''}{a.players.is_guest ? <span className="caption muted"> · convidado, sem pontos</span> : null}</span>
                <span className="caption muted">{a.team === 'preto' ? 'Preto' : 'Branco'}</span>
              </label>
            ))}
          </section>

          <button className="btn gold block" disabled={busy} onClick={save}>{busy ? 'Salvando…' : match.status === 'encerrada' ? 'Salvar correção' : 'Lançar no ranking'}</button>

          {match.status === 'encerrada' && (
            <section className="card stack" style={{ gap: 12 }}>
              <h2 className="h-title" style={{ fontSize: 18 }}>Marditos da Noite</h2>
              {match.photo_url
                ? <img src={match.photo_url} crossOrigin="anonymous" alt="Foto do time vencedor" style={{ width: '100%', borderRadius: 12, display: 'block' }} />
                : <p className="small muted" style={{ margin: 0 }}>Poste a foto do time vencedor. Ela aparece no início e na galeria do ano.</p>}
              <label className="btn ghost block sm" style={{ cursor: 'pointer' }}>
                {busy ? 'Enviando…' : match.photo_url ? 'Trocar foto' : 'Escolher foto'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => onPhoto(e.target.files?.[0])} />
              </label>
            </section>
          )}
        </>
      )}

      {recent.length > 0 && (
        <section className="stack">
          <p className="eyebrow">Corrigir súmula anterior</p>
          {recent.map((m) => (
            <button key={m.id} className="list-row" onClick={() => open(m)}>
              <span style={{ flex: 1 }}>{formatDate(m.date)}</span>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>{m.score_preto} × {m.score_branco}</span>
            </button>
          ))}
        </section>
      )}
      {toastNode}
    </main>
  )
}
