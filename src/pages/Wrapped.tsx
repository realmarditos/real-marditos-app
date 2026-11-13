import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { toPng } from 'html-to-image'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { RankingRow } from '../lib/types'
import { useHistory, gamesOf, bestWinStreak, awardsOf, rivalries, badgesOf, plural } from '../lib/stats'
import { avatarUri } from '../lib/avatar'
import { IMG } from '../lib/assets'
import { Icon } from '../components/ui'

/** A retrospectiva fica disponível em dezembro e janeiro. */
// Só em dezembro: em janeiro o ranking já zerou para a temporada nova
export const wrappedAvailable = () => new Date().getMonth() === 11

type Slide = { bg: string; ink: string; body: ReactNode }

export default function Wrapped() {
  const { player } = useAuth()
  const nav = useNavigate()
  const h = useHistory()
  const [rank, setRank] = useState<{ pos: number; row: RankingRow; total: number } | null>(null)
  const season = new Date().getFullYear()
  const [i, setI] = useState(0)
  const [shareImg, setShareImg] = useState<string | null>(null)
  const finalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.rpc('ranking').then(({ data }) => {
      const rows = (data as RankingRow[]) ?? []
      const k = rows.findIndex((r) => r.player_id === player?.id)
      if (k >= 0) setRank({ pos: k + 1, row: rows[k], total: rows.length })
    })
  }, [player?.id])

  if (!h || !player) return <div className="center-page"><p className="muted">Preparando sua retrospectiva…</p></div>

  const games = gamesOf(h, player.id, season)
  const seasonMatches = h.matches.filter((m) => m.date.startsWith(String(season))).length
  const w = games.filter((g) => g.result === 'V').length
  const e = games.filter((g) => g.result === 'E').length
  const d = games.filter((g) => g.result === 'D').length
  const apr = games.length ? Math.round(((w * 3 + e) / (games.length * 3)) * 100) : 0
  const pres = seasonMatches ? Math.round((games.length / seasonMatches) * 100) : 0
  const streak = bestWinStreak(games)
  const mvps = awardsOf(h, player.id, 'mvp', season)
  const bagres = awardsOf(h, player.id, 'bagre', season)
  const { partner, nemesis, victim } = rivalries(h, player.id, season)
  const unlocked = badgesOf(h, player.id).filter((b) => b.unlocked)

  const Big = ({ children, size = 96 }: { children: ReactNode; size?: number }) => (
    <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: size, lineHeight: 1 }}>{children}</p>
  )
  const Title = ({ children }: { children: ReactNode }) => (
    <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 34, lineHeight: '38px', textTransform: 'uppercase' }}>{children}</h2>
  )
  const Text = ({ children }: { children: ReactNode }) => <p style={{ margin: 0, fontSize: 17, lineHeight: '25px', opacity: 0.9 }}>{children}</p>

  const slides: Slide[] = [
    { bg: 'var(--brand-blue)', ink: 'var(--ink)', body: (
      <>
        <img src={IMG.logo} alt="" style={{ width: 120, alignSelf: 'center' }} />
        <Title>Seu {season} no Real Marditos</Title>
        <img src={avatarUri(player.avatar, player.name)} alt="" style={{ width: 140, height: 140, borderRadius: 20, alignSelf: 'center', background: 'var(--brand-blue-bright)' }} />
        <Text>{player.name}, bora relembrar o ano. Toque para avançar.</Text>
      </>
    ) },
    { bg: 'var(--surface)', ink: 'var(--ink)', body: (
      <>
        <Text>Você entrou em campo</Text>
        <Big>{games.length}</Big>
        <Title>{games.length === 1 ? 'vez' : 'vezes'}</Title>
        <Text>{seasonMatches ? `Presença em ${pres}% das quintas registradas no app.` : 'O app ainda não registrou partidas nesta temporada.'}{pres === 100 && seasonMatches >= 2 ? ' Pé de rato raiz!' : ''}</Text>
      </>
    ) },
    { bg: 'var(--gold)', ink: 'var(--brand-navy)', body: (
      <>
        <Title>Resultados</Title>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, textAlign: 'center' }}>
          {[['V', w, 'vitórias'], ['E', e, 'empates'], ['D', d, 'derrotas']].map(([k, v, l]) => (
            <div key={String(k)}><Big size={72}>{v}</Big><Text>{l}</Text></div>
          ))}
        </div>
        <Text>Aproveitamento de <strong>{apr}%</strong>. {streak > 1 ? <>Sua maior sequência foi de <strong>{streak} vitórias</strong> seguidas.</> : null}</Text>
      </>
    ) },
    { bg: 'var(--brand-navy)', ink: 'var(--ink)', body: (
      <>
        <img src={IMG.coroa} alt="" style={{ width: 96, alignSelf: 'center' }} />
        <Title>{mvps ? `${mvps} ${mvps === 1 ? 'vez' : 'vezes'} MVP` : 'Nenhum MVP (ainda)'}</Title>
        <Text>{mvps ? `A galera te escolheu como o melhor da noite. São +${mvps} no ranking.` : 'Ano que vem a coroa é sua.'}</Text>
        <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
        <Title>{bagres ? `${bagres} ${bagres === 1 ? 'vez' : 'vezes'} bagre` : 'Zero bagres'}</Title>
        <Text>{bagres >= 3 ? 'Patrimônio da zoeira do Real Marditos.' : bagres ? 'Faz parte. Todo craque tem seu dia de bagre.' : 'Escapou da zoeira o ano inteiro. Respeito.'}</Text>
      </>
    ) },
    { bg: 'var(--brand-blue)', ink: 'var(--ink)', body: (
      <>
        <Title>Duplas e rivalidades</Title>
        {[
          ['Sua dupla', partner, partner && `${plural(partner.wins, 'vitória', 'vitórias')} em ${partner.games} jogos juntos`],
          ['Seu carrasco', nemesis, nemesis && `te venceu ${nemesis.losses} ${nemesis.losses === 1 ? 'vez' : 'vezes'}`],
          ['Seu freguês', victim, victim && `você venceu ${victim.wins} ${victim.wins === 1 ? 'vez' : 'vezes'}`],
        ].map(([label, p, txt]) => (
          <div key={String(label)} style={{ background: 'rgba(11,14,26,.35)', borderRadius: 12, padding: '12px 14px' }}>
            <p className="eyebrow" style={{ color: 'var(--ink)', opacity: 0.8 }}>{String(label)}</p>
            <p style={{ margin: '2px 0 0', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 28, textTransform: 'uppercase' }}>{p ? (p as { name: string }).name : '—'}</p>
            <p className="small" style={{ margin: 0, opacity: 0.85 }}>{txt ? String(txt) : 'Jogos juntos insuficientes'}</p>
          </div>
        ))}
      </>
    ) },
    { bg: 'var(--surface)', ink: 'var(--ink)', body: (
      <>
        <Text>No ranking de {season}, você terminou em</Text>
        <Big size={120}>{rank ? `${rank.pos}º` : '–'}</Big>
        <Title>{rank ? `${rank.row.points} pontos` : ''}</Title>
        <Text>{rank?.pos === 1 ? 'Campeão da temporada. A coroa é sua!' : rank && rank.pos <= 3 ? 'No pódio do Real Marditos. Brabo!' : `De ${rank?.total ?? 0} jogadores na disputa.`}</Text>
      </>
    ) },
    { bg: 'var(--brand-navy)', ink: 'var(--ink)', body: (
      <>
        <Title>Conquistas</Title>
        {unlocked.length === 0 && <Text>Nenhuma conquista desbloqueada ainda. Ano que vem tem mais.</Text>}
        {unlocked.map((b) => (
          <div key={b.id} className="between" style={{ background: 'var(--surface)', borderRadius: 12, padding: '12px 14px', border: '1px solid var(--gold)' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 22, textTransform: 'uppercase' }}>{b.title}</span>
            <span className="small gold-text" style={{ fontWeight: 600 }}>{b.level}</span>
          </div>
        ))}
      </>
    ) },
    { bg: 'var(--bg)', ink: 'var(--ink)', body: (
      <>
        <div ref={finalRef} className="stripes" style={{ background: 'var(--brand-blue)', borderRadius: 20, padding: 20, display: 'flex', flexDirection: 'column', gap: 12, border: '3px solid var(--gold)' }}>
          <div className="between">
            <img src={IMG.escudo} alt="" style={{ width: 44 }} />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, letterSpacing: '.06em' }}>RETROSPECTIVA {season}</span>
          </div>
          <div className="row" style={{ gap: 12 }}>
            <img src={avatarUri(player.avatar, player.name)} alt="" style={{ width: 72, height: 72, borderRadius: 14, background: 'var(--brand-blue-bright)' }} />
            <div>
              <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 30, textTransform: 'uppercase', lineHeight: 1 }}>{player.name}</p>
              <p className="small" style={{ margin: '4px 0 0' }}>{rank ? `${rank.pos}º no ranking · ${rank.row.points} pts` : ''}</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            {[[games.length, 'jogos'], [w, 'vitórias'], [`${apr}%`, 'aproveit.'], [mvps, 'MVPs'], [bagres, 'bagres'], [`${pres}%`, 'presença']].map(([v, l]) => (
              <div key={String(l)} style={{ background: 'rgba(11,14,26,.35)', borderRadius: 10, padding: '8px 10px' }}>
                <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 26 }}>{v}</p>
                <p className="caption" style={{ margin: 0, opacity: 0.85 }}>{l}</p>
              </div>
            ))}
          </div>
          {partner && <p className="small" style={{ margin: 0 }}>Dupla do ano: <strong>{partner.name}</strong></p>}
          <p className="caption" style={{ margin: 0, opacity: 0.8, letterSpacing: '.1em', fontWeight: 600 }}>REAL MARDITOS FC</p>
        </div>
        <button className="btn gold block" onClick={async (ev) => {
          ev.stopPropagation()
          if (!finalRef.current) return
          let data: string | null = null
          try { data = await toPng(finalRef.current, { pixelRatio: 3 }) } catch { try { data = await toPng(finalRef.current, { pixelRatio: 3, skipFonts: true }) } catch { data = null } }
          if (!data) return
          try {
            const file = new File([await (await fetch(data)).blob()], `retrospectiva-${season}.png`, { type: 'image/png' })
            if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: `Minha retrospectiva ${season} · Real Marditos` }); return }
          } catch { /* mostra a imagem */ }
          setShareImg(data)
        }}>Compartilhar retrospectiva</button>
      </>
    ) },
  ]

  const s = slides[i]
  const go = (delta: number) => setI((k) => Math.max(0, Math.min(slides.length - 1, k + delta)))

  return (
    <div style={{ minHeight: '100dvh', background: s.bg, color: s.ink, display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto', position: 'relative' }}
      onClick={(e) => { const x = e.clientX - (e.currentTarget.getBoundingClientRect().left); go(x < e.currentTarget.clientWidth / 3 ? -1 : 1) }}>
      <div style={{ display: 'flex', gap: 4, padding: 'calc(env(safe-area-inset-top) + 12px) 12px 0' }} aria-hidden="true">
        {slides.map((_, k) => <span key={k} style={{ flex: 1, height: 3, borderRadius: 2, background: s.ink, opacity: k <= i ? 0.95 : 0.25 }} />)}
      </div>
      <div className="between" style={{ padding: '8px 12px' }}>
        <span className="caption" style={{ fontWeight: 600, letterSpacing: '.08em', opacity: 0.8 }}>RETROSPECTIVA {season}</span>
        <button aria-label="Fechar retrospectiva" onClick={(e) => { e.stopPropagation(); nav('/') }} style={{ background: 'none', border: 0, color: 'inherit', width: 44, height: 44 }}>
          <span style={{ fontSize: 26, lineHeight: 1 }}>×</span>
        </button>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18, padding: '0 24px 48px' }}>
        {s.body}
      </div>
      {i < slides.length - 1 && (
        <p className="caption" style={{ position: 'absolute', bottom: 'calc(env(safe-area-inset-bottom) + 16px)', left: 0, right: 0, textAlign: 'center', opacity: 0.6, margin: 0 }}>
          toque para continuar <span style={{ display: 'inline-block', transform: 'scaleX(-1)' }}><Icon name="back" size={12} /></span>
        </p>
      )}
      {shareImg && (
        <div className="sheet-bg" style={{ alignItems: 'center' }} onClick={(e) => { e.stopPropagation(); setShareImg(null) }}>
          <div className="stack" style={{ alignItems: 'center', padding: 16 }} onClick={(e) => e.stopPropagation()}>
            <img src={shareImg} alt="Sua retrospectiva" style={{ width: 320, maxWidth: '90vw', borderRadius: 16 }} />
            <p className="small" style={{ margin: 0, color: 'var(--ink)' }}>Segure a imagem para salvar ou compartilhar.</p>
            <button className="btn ghost sm" onClick={() => setShareImg(null)}>Fechar</button>
          </div>
        </div>
      )}
    </div>
  )
}
