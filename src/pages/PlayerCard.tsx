import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toPng } from 'html-to-image'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Player, RankingRow } from '../lib/types'
import { POSITION_SHORT } from '../lib/types'
import { avatarUri } from '../lib/avatar'
import { Icon } from '../components/ui'
import { IMG } from '../lib/assets'
import { Badges, Rivalries } from '../components/Achievements'

const SHAPE = 'polygon(14% 0, 86% 0, 100% 7%, 100% 88%, 50% 100%, 0 88%, 0 7%)'
/** Acabamento dos cards do pódio: ouro, prata e bronze. */
type Tier = { frame: string; bg: string; ink: string; accent: string }
const TIERS: Record<number, Tier> = {
  1: { frame: 'linear-gradient(135deg,#FFF1B8 0%,#F0B43C 30%,#9A6512 55%,#F7D36A 78%,#B77B1C 100%)',
       bg: 'linear-gradient(160deg,#FCE59A 0%,#EDB648 45%,#C98A22 100%)', ink: '#2A1A04', accent: '#5C3A06' },
  2: { frame: 'linear-gradient(135deg,#FFFFFF 0%,#C9CED6 30%,#6E7684 55%,#E8EBF0 78%,#8C94A1 100%)',
       bg: 'linear-gradient(160deg,#F4F6F9 0%,#CDD2DA 45%,#9AA2AE 100%)', ink: '#141832', accent: '#2E3442' },
  3: { frame: 'linear-gradient(135deg,#FFD9B5 0%,#D08A52 30%,#7A4219 55%,#E8A877 78%,#8E5228 100%)',
       bg: 'linear-gradient(160deg,#F6C9A0 0%,#D69361 45%,#A5622F 100%)', ink: '#24120A', accent: '#4E2810' },
}


export default function PlayerCard() {
  const { id } = useParams()
  const { player: me } = useAuth()
  const nav = useNavigate()
  const pid = id ?? me?.id
  const [p, setP] = useState<Player | null>(null)
  const [row, setRow] = useState<RankingRow | null>(null)
  const [pos, setPos] = useState(0)
  const [total, setTotal] = useState(0)
  const season = new Date().getFullYear()
  const [img, setImg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!pid) return
    Promise.all([
      supabase.from('players').select('*').eq('id', pid).maybeSingle(),
      supabase.rpc('ranking'),
      supabase.from('matches').select('id,date').eq('status', 'encerrada'),
    ]).then(([{ data: pl }, { data: rk }, { data: ms }]) => {
      const s = season
      setP(pl as Player)
      const rows = (rk as RankingRow[]) ?? []
      const i = rows.findIndex((r) => r.player_id === pid)
      setRow(rows[i] ?? null)
      setPos(i + 1)
      setTotal(((ms as { date: string }[]) ?? []).filter((m) => Number(m.date.slice(0, 4)) === s).length)
    })
  }, [pid])

  if (!p) return <main className="screen no-tabs"><p className="muted">Carregando…</p></main>

  const g = row?.games ?? 0
  const apr = g ? Math.round((((row?.wins ?? 0) * 3 + (row?.draws ?? 0)) / (g * 3)) * 100) : 0
  const pre = total ? Math.round((g / total) * 100) : 0
  const stats: [string, string | number][] = [
    ['PTS', row?.points ?? 0], ['JOG', g], ['VIT', row?.wins ?? 0],
    ['MVP', row?.mvps ?? 0], ['APR', `${apr}%`], ['PRE', `${pre}%`],
  ]
  const tier = TIERS[pos] as Tier | undefined
  const ink = tier?.ink ?? 'var(--ink)'
  const accent = tier?.accent ?? 'var(--gold)'
  const posLabel = p.is_goalkeeper ? 'GOL' : POSITION_SHORT[p.position ?? ''] ?? 'LIN'

  async function share() {
    if (!cardRef.current) return
    setBusy(true)
    let data: string | null = null
    try {
      data = await toPng(cardRef.current, { pixelRatio: 3, cacheBust: true })
    } catch {
      try { data = await toPng(cardRef.current, { pixelRatio: 3, skipFonts: true }) } catch { data = null }
    }
    setBusy(false)
    if (!data) return
    try {
      const blob = await (await fetch(data)).blob()
      const file = new File([blob], `card-${p!.name.toLowerCase()}.png`, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Card do ${p!.name} · Real Marditos FC` })
        return
      }
    } catch { /* sem compartilhamento: mostra a imagem */ }
    setImg(data)
  }

  return (
    <main className="screen no-tabs" style={{ alignItems: 'center' }}>
      <header className="between" style={{ width: '100%' }}>
        <button onClick={() => nav(-1)} aria-label="Voltar" className="btn ghost" style={{ width: 44, height: 44, padding: 0, borderRadius: 999 }}><Icon name="back" size={20} /></button>
        <h1 className="h-l" style={{ fontSize: 24 }}>Card</h1>
        <span style={{ width: 44 }} />
      </header>

      {/* O card: fundo do próprio card para a imagem exportada sair completa */}
      <div ref={cardRef} style={{ padding: 16, background: 'var(--bg)' }}>
        <div style={{ width: 300, height: 450, position: 'relative', background: tier?.frame ?? 'var(--gold)', color: ink, clipPath: SHAPE }}>
          <div className="stripes" style={{ position: 'absolute', inset: 4, background: tier?.bg ?? 'var(--brand-blue)', clipPath: SHAPE }} />
          <div style={{ position: 'absolute', top: 34, left: 28, width: 72, textAlign: 'center', lineHeight: 1 }}>
            <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 44, color: accent }}>{pos || '–'}º</p>
            <p style={{ margin: '2px 0 0', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 20 }}>{posLabel}</p>
            <img src={IMG.escudo} alt="" style={{ width: 34, marginTop: 10 }} />
            {p.shirt_number != null && <p style={{ margin: '8px 0 0', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18 }}>#{p.shirt_number}</p>}
          </div>
          <img src={avatarUri(p.avatar, p.name)} alt={`Avatar de ${p.name}`}
            style={{ position: 'absolute', top: 36, right: 26, width: 168, height: 168, borderRadius: 16, background: 'var(--brand-blue-bright)' }} />
          <div style={{ position: 'absolute', top: 218, left: 20, right: 20, textAlign: 'center' }}>
            <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 32, lineHeight: '36px', textTransform: 'uppercase', letterSpacing: '.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</p>
            <div style={{ height: 2, background: accent, margin: '6px 24px 10px' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: 8, rowGap: 4, padding: '0 10px' }}>
              {stats.map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24, minWidth: 58, textAlign: 'right' }}>{v}</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 15, opacity: 0.85 }}>{k}</span>
                </div>
              ))}
            </div>
            <p style={{ margin: '12px 0 0', fontSize: 10, fontWeight: 600, letterSpacing: '.12em', opacity: 0.8 }}>REAL MARDITOS FC · {season}{p.role && p.role !== 'membro' ? ` · ${p.role.toUpperCase()}` : ''}</p>
          </div>
        </div>
      </div>

      <p className="caption muted" style={{ margin: 0, textAlign: 'center', maxWidth: 320 }}>
        PTS pontos · JOG jogos · VIT vitórias · MVP prêmios de MVP · APR aproveitamento · PRE presença nas quintas
      </p>
      <div className="stack" style={{ width: '100%' }}>
        <button className="btn gold block" disabled={busy} onClick={share}>{busy ? 'Gerando imagem…' : 'Compartilhar card'}</button>
        {p.id === me?.id && <Link to="/perfil/avatar" className="btn ghost block sm" style={{ textDecoration: 'none' }}>Mudar avatar</Link>}
      </div>

      <div className="stack" style={{ width: '100%', gap: 16 }}>
        <Badges playerId={p.id} />
        <Rivalries playerId={p.id} self={p.id === me?.id} />
      </div>

      {img && (
        <div className="sheet-bg" style={{ alignItems: 'center' }} onClick={() => setImg(null)}>
          <div className="stack" style={{ alignItems: 'center', padding: 16 }} onClick={(e) => e.stopPropagation()}>
            <img src={img} alt={`Card de ${p.name}`} style={{ width: 300, maxWidth: '90vw' }} />
            <p className="small" style={{ margin: 0, textAlign: 'center' }}>Segure a imagem para salvar ou compartilhar.</p>
            <a href={img} download={`card-${p.name.toLowerCase()}.png`} className="btn ghost sm">Baixar imagem</a>
            <button className="btn ghost sm" onClick={() => setImg(null)}>Fechar</button>
          </div>
        </div>
      )}
    </main>
  )
}
