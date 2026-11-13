/**
 * Artes para mandar no WhatsApp: ranking da temporada e duplas/rivalidades.
 * Tamanho fixo (360 px de largura); a imagem sai em 3x (1080 px).
 */
import { useEffect, useState } from 'react'
import type { AvatarOptions, RankingRow } from '../lib/types'
import { avatarUri } from '../lib/avatar'
import { IMG } from '../lib/assets'

const NAVY = '#0B0E1A'
const SURFACE = '#141832'
const RAISED = '#1C2244'
const BLUE = '#2F5C9E'
const SKY = '#6F9BDB'
const GOLD = '#F0A033'
const INK = '#F5F7FA'
const MUTED = '#9AA3BF'
const DISPLAY = '"Oswald", "Arial Narrow", sans-serif'

const stripes = `repeating-linear-gradient(135deg, rgba(140,151,171,.07) 0 2px, transparent 2px 14px)`
const today = () => new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

function Av({ a, seed, size }: { a: AvatarOptions | null | undefined; seed: string; size: number }) {
  return <img src={avatarUri(a, seed)} alt="" style={{ width: size, height: size, borderRadius: size * 0.22, background: SKY, display: 'block' }} />
}

function Footer() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0 14px', borderTop: `1px solid ${RAISED}` }}>
      <img src={IMG.escudo} alt="" style={{ width: 22 }} />
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.1em', color: MUTED, whiteSpace: 'nowrap' }}>REAL MARDITOS FC · QUINTAS 19H · LINCE ARENA</span>
    </div>
  )
}

/** Ranking completo da temporada: pódio e a lista. */
export function RankingArt({ rows, season }: { rows: RankingRow[]; season: number }) {
  const [first, second, third] = rows
  const rest = rows.slice(3)
  const podium = [second, first, third]
  return (
    <div style={{ width: 360, background: `${stripes}, ${NAVY}`, color: INK, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center', padding: '18px 16px 6px' }}>
        <img src={IMG.logo} alt="" style={{ width: 64 }} />
        <p style={{ margin: '4px 0 0', fontFamily: DISPLAY, fontWeight: 700, fontSize: 34, lineHeight: '38px', letterSpacing: '.02em' }}>RANKING {season}</p>
        <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '.16em', color: GOLD }}>ATUALIZADO EM {today()}</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, padding: '10px 18px 0' }}>
        {podium.map((r, i) => {
          if (!r) return <div key={i} style={{ flex: 1 }} />
          const pos = r === first ? 1 : r === second ? 2 : 3
          const metal = pos === 1 ? GOLD : pos === 2 ? '#C9CED6' : '#D08A52'
          return (
            <div key={r.player_id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              {pos === 1 && <img src={IMG.coroa} alt="" style={{ width: 34, marginBottom: -2 }} />}
              <div style={{ padding: 3, borderRadius: 18, background: metal }}><Av a={r.avatar} seed={r.name} size={pos === 1 ? 66 : 54} /></div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</p>
              <div style={{ width: '100%', height: pos === 1 ? 70 : pos === 2 ? 54 : 42, background: pos === 1 ? BLUE : RAISED, borderRadius: '10px 10px 0 0', borderTop: `3px solid ${metal}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: pos === 1 ? 24 : 19, lineHeight: 1 }}>{pos}º</span>
                <span style={{ fontSize: 11, color: pos === 1 ? INK : MUTED }}>{r.points} pts</span>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ padding: '10px 14px 12px', display: 'flex', flexDirection: 'column', gap: 4, background: SURFACE }}>
        {rest.map((r, i) => (
          <div key={r.player_id} style={{ display: 'grid', gridTemplateColumns: '24px 22px 1fr auto', gap: 8, alignItems: 'center', height: 26 }}>
            <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 14, color: MUTED, textAlign: 'right' }}>{i + 4}</span>
            <Av a={r.avatar} seed={r.name} size={22} />
            <span style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.name}{r.mvps > 0 && <span style={{ color: GOLD, fontWeight: 700, fontSize: 11 }}>{'  ★'}{r.mvps}</span>}
            </span>
            <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 15, color: GOLD }}>{r.points}</span>
          </div>
        ))}
      </div>
      <Footer />
    </div>
  )
}

export type RivalryKind = 'dupla' | 'carrasco' | 'fregues'
const RIVAL: Record<RivalryKind, { title: string; join: string; color: string }> = {
  dupla: { title: 'DUPLA DE OURO', join: '&', color: GOLD },
  carrasco: { title: 'CARRASCO', join: '×', color: '#F07A6A' },
  fregues: { title: 'FREGUÊS', join: '×', color: '#4CC38A' },
}

/** Uma dupla ou rivalidade entre dois jogadores. "me" é o dono do card; "other" é a dupla, o carrasco ou o freguês. */
export function RivalryArt({ kind, me, other, games, wins, losses }: {
  kind: RivalryKind
  me: { name: string; avatar: AvatarOptions | null | undefined }
  other: { name: string; avatar: AvatarOptions | null | undefined }
  games: number; wins: number; losses: number
}) {
  const r = RIVAL[kind]
  const big = kind === 'dupla' ? `${wins} de ${games}` : kind === 'carrasco' ? `${losses} de ${games}` : `${wins} de ${games}`
  const line = kind === 'dupla'
    ? `vitórias jogando juntos`
    : kind === 'carrasco' ? `jogos perdidos de ${me.name} contra ${other.name}` : `jogos vencidos de ${me.name} contra ${other.name}`
  const tag = kind === 'dupla'
    ? 'Juntos, ninguém segura.'
    : kind === 'carrasco' ? `${other.name} é o pesadelo de ${me.name}.` : `${other.name} é freguês de ${me.name}. Fato.`
  const left = kind === 'carrasco' ? other : me
  const right = kind === 'carrasco' ? me : other
  return (
    <div style={{ width: 360, background: `${stripes}, ${NAVY}`, color: INK, fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'center' }}>
      <div style={{ padding: '22px 16px 0' }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '.2em', color: MUTED }}>REAL MARDITOS FC · {new Date().getFullYear()}</p>
        <p style={{ margin: '6px 0 0', fontFamily: DISPLAY, fontWeight: 700, fontSize: 34, lineHeight: '40px', color: r.color, letterSpacing: '.02em', whiteSpace: 'nowrap' }}>{r.title}</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '18px 16px 6px' }}>
        {[left, right].map((p, i) => (
          <div key={i} style={{ display: 'contents' }}>
            {i === 1 && <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 40, color: r.color }}>{r.join}</span>}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 120 }}>
              <div style={{ padding: 3, borderRadius: 26, background: r.color }}><Av a={p.avatar} seed={p.name} size={108} /></div>
              <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 20, textTransform: 'uppercase', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ margin: '10px 20px 0', padding: '14px 12px', background: SURFACE, borderRadius: 14 }}>
        <p style={{ margin: 0, fontFamily: DISPLAY, fontWeight: 700, fontSize: 36, lineHeight: '40px', color: GOLD }}>{big}</p>
        <p style={{ margin: '2px 0 0', fontSize: 13, color: MUTED }}>{line}</p>
      </div>
      <p style={{ margin: '14px 20px 16px', fontSize: 16, fontWeight: 700 }}>{tag}</p>
      <Footer />
    </div>
  )
}

type ArtPlayer = { id: string; name: string; avatar: AvatarOptions | null | undefined; gk?: boolean; guest?: boolean }

/** Converte a foto (de outro endereço) em dados locais, para a imagem gerada sempre incluir a foto. */
function useDataUrl(url?: string | null) {
  const [data, setData] = useState<string | null>(null)
  useEffect(() => {
    if (!url) return
    let alive = true
    fetch(url, { mode: 'cors', cache: 'no-store' }).then((r) => r.blob()).then((b) => new Promise<string>((ok, err) => {
      const fr = new FileReader(); fr.onload = () => ok(String(fr.result)); fr.onerror = err; fr.readAsDataURL(b)
    })).then((d) => { if (alive) setData(d) }).catch(() => { if (alive) setData(url) })
    return () => { alive = false }
  }, [url])
  return data
}

const nowrap = { whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }

/** Resultado de uma partida no formato de story (9:16): placar, foto e vencedores, e quem perdeu. */
export function MatchArt({ date, venue, preto, branco, scorePreto, scoreBranco, photo, mvpIds }: {
  date: string; venue: string; preto: ArtPlayer[]; branco: ArtPlayer[]
  scorePreto: number; scoreBranco: number; photo?: string | null; mvpIds?: string[]
}) {
  const isMvp = (id: string) => (mvpIds ?? []).includes(id)
  const photoData = useDataUrl(photo)
  const draw = scorePreto === scoreBranco
  const pretoWon = scorePreto > scoreBranco
  const winners = draw ? [] : pretoWon ? preto : branco
  const losers = draw ? [] : pretoWon ? branco : preto
  const [y, m, d] = date.split('-').map(Number)
  const wd = ['DOMINGO', 'SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO'][new Date(y, m - 1, d).getDay()]
  const when = `${wd}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`
  const mark = (p: ArtPlayer) => (p.gk ? ' (GOL)' : '') + (p.guest ? ' (CONV.)' : '')

  const Side = ({ label, score, won, dark }: { label: string; score: number; won: boolean; dark: boolean }) => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: '.12em', color: won ? GOLD : MUTED, ...nowrap }}>
        <span style={{ width: 11, height: 11, borderRadius: 999, background: dark ? '#000' : INK, border: `2px solid ${dark ? MUTED : INK}` }} />{label}
      </span>
      <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 46, lineHeight: '50px', color: won ? INK : MUTED }}>{score}</span>
    </div>
  )

  const Winner = ({ p }: { p: ArtPlayer }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 0 }}>
      <div style={{ position: 'relative', padding: 2, borderRadius: 10, background: GOLD }}>
        <Av a={p.avatar} seed={p.name} size={34} />
        {isMvp(p.id) && <img src={IMG.coroa} alt="" style={{ position: 'absolute', top: -12, left: 'calc(50% - 12px)', width: 24 }} />}
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, maxWidth: '100%', ...nowrap }}>{p.name}</span>
      <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '.06em', color: GOLD, height: 10, lineHeight: '10px', marginTop: -2, ...nowrap }}>
        {[isMvp(p.id) && 'MVP', p.gk && 'GOL', p.guest && 'CONV.'].filter(Boolean).join(' · ')}
      </span>
    </div>
  )
  const Loser = ({ p }: { p: ArtPlayer }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, opacity: 0.75 }}>
      <Av a={p.avatar} seed={p.name} size={18} />
      <span style={{ fontSize: 11, color: MUTED, ...nowrap }}>{p.name}{mark(p)}{isMvp(p.id) && <span style={{ color: GOLD, fontWeight: 700 }}> ★ MVP</span>}</span>
    </div>
  )
  const label = (t: string, color = MUTED) => <p style={{ margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: '.18em', color, ...nowrap }}>{t}</p>

  return (
    <div style={{ width: 360, height: 640, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: `${stripes}, ${NAVY}`, color: INK, fontFamily: '"Inter", system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px 0' }}>
        <img src={IMG.logo} alt="" style={{ height: 40, width: 32, objectFit: 'contain' }} />
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontFamily: DISPLAY, fontWeight: 700, fontSize: 19, lineHeight: '22px', ...nowrap }}>RESULTADO DA QUINTA</p>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '.12em', color: GOLD, ...nowrap }}>{when} · {venue.toUpperCase()}</p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', padding: '4px 16px 0' }}>
        <Side label="PRETO" score={scorePreto} won={!draw && pretoWon} dark />
        <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 26, color: MUTED }}>×</span>
        <Side label="BRANCO" score={scoreBranco} won={!draw && !pretoWon} dark={false} />
      </div>
      <p style={{ margin: '4px 0 8px', textAlign: 'center', fontFamily: DISPLAY, fontWeight: 700, fontSize: 20, letterSpacing: '.03em', color: draw ? INK : GOLD, ...nowrap }}>
        {draw ? 'EMPATE' : `VITÓRIA DO TIME ${pretoWon ? 'PRETO' : 'BRANCO'}`}
      </p>

      {photo && (
        <div style={{ position: 'relative', margin: '0 16px 10px', height: 156, borderRadius: 14, overflow: 'hidden', border: `2px solid ${GOLD}`, background: SURFACE, flex: '0 0 auto' }}>
          {photoData && <img src={photoData} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
          <span style={{ position: 'absolute', left: 8, bottom: 8, background: GOLD, color: NAVY, fontSize: 9, fontWeight: 800, letterSpacing: '.12em', padding: '3px 8px', borderRadius: 999, ...nowrap }}>MARDITOS DA NOITE</span>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', gap: 6, padding: '0 16px 6px', minHeight: 0 }}>
        {draw ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{label('TIME PRETO')}<div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 5 }}>{preto.map((p) => <Loser key={p.id} p={p} />)}</div></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{label('TIME BRANCO')}<div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 5 }}>{branco.map((p) => <Loser key={p.id} p={p} />)}</div></div>
          </>
        ) : (
          <>
            <div style={{ padding: '10px 4px 8px', background: SURFACE, borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ textAlign: 'center' }}>{label('★ VENCEDORES ★', GOLD)}</div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${winners.length > 7 ? Math.ceil(winners.length / 2) : Math.max(winners.length, 1)}, minmax(0, 1fr))`, gap: 2, rowGap: 16 }}>
                {winners.map((p) => <Winner key={p.id} p={p} />)}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {label('FICARAM PELO CAMINHO')}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 4 }}>{losers.map((p) => <Loser key={p.id} p={p} />)}</div>
            </div>
          </>
        )}
      </div>
      <Footer />
    </div>
  )
}
