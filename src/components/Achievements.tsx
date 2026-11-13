import { useState, type ReactNode } from 'react'
import ShareArt from './ShareArt'
import { RivalryArt, type RivalryKind } from './Arts'
import { useHistory, badgesOf, rivalries, plural, type Badge, type BadgeId, type Pair } from '../lib/stats'
import { IMG } from '../lib/assets'

const ICON: Record<BadgeId, ReactNode> = {
  invicto: <path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.2 1-3.6 2.2-4.8.3 1.6 1 2.6 2.3 3C10.9 8.6 11.3 5.6 12 3z" />,
  pe_de_rato: <><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17" /><path d="M8 3v4" /><path d="M16 3v4" /><path d="m9 15 2 2 4-4" /></>,
  rei_da_noite: null,
  bagre_de_ouro: <><path d="M3 12c3-5 9-6 13-2l5-3-1.5 5L21 17l-5-3c-4 4-10 3-13-2z" /><circle cx="8" cy="11" r="1" /></>,
  veterano: <><circle cx="12" cy="9" r="5" /><path d="m8.5 13.5-1.5 7 5-2.5 5 2.5-1.5-7" /></>,
}

function BadgeTile({ b }: { b: Badge }) {
  const color = b.unlocked ? 'var(--gold)' : 'var(--border)'
  return (
    <div className="card stack" style={{ alignItems: 'center', textAlign: 'center', gap: 6, padding: '14px 8px', opacity: b.unlocked ? 1 : 0.55, border: b.unlocked ? '1px solid var(--gold)' : '1px solid transparent' }} title={b.next ?? undefined}>
      <span style={{ width: 48, height: 48, borderRadius: 999, background: b.unlocked ? 'var(--brand-navy)' : 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `inset 0 0 0 2px ${color}` }}>
        {b.id === 'rei_da_noite'
          ? <img src={IMG.coroa} alt="" style={{ width: 30, filter: b.unlocked ? 'none' : 'grayscale(1) brightness(.6)' }} />
          : <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={b.unlocked ? 'var(--gold)' : 'var(--ink-muted)'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICON[b.id]}</svg>}
      </span>
      <span className="small" style={{ fontWeight: 600 }}>{b.title}</span>
      <span className="caption" style={{ color: b.unlocked ? 'var(--gold-text)' : 'var(--ink-muted)' }}>{b.unlocked ? b.level : 'Bloqueada'}</span>
      <span className="caption muted">{b.unlocked ? b.detail : b.next ?? b.detail}</span>
    </div>
  )
}

function PairCard({ label, hint, p, stat, onOpen }: { label: string; hint: string; p: Pair | null; stat: (p: Pair) => string; onOpen: () => void }) {
  const body = (
    <>
      <span className="eyebrow" style={{ fontSize: 11 }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p ? p.name : '—'}</span>
      <span className="caption muted">{p ? stat(p) : hint}</span>
      {p && <span className="caption" style={{ color: 'var(--brand-blue-bright)', fontWeight: 600, marginTop: 2 }}>Mandar no zap</span>}
    </>
  )
  return p
    ? <button type="button" className="card stack" onClick={onOpen} style={{ gap: 2, padding: '12px 10px', textAlign: 'left', color: 'inherit', border: '1px solid var(--border)', cursor: 'pointer', minWidth: 0 }}>{body}</button>
    : <div className="card stack" style={{ gap: 2, padding: '12px 10px', minWidth: 0 }}>{body}</div>
}

export function Rivalries({ playerId, self }: { playerId: string; self: boolean }) {
  const h = useHistory()
  const [open, setOpen] = useState<RivalryKind | null>(null)
  if (!h) return null
  const { partner, nemesis, victim } = rivalries(h, playerId)
  const me = { name: h.names[playerId] ?? '', avatar: h.avatars[playerId] }
  const pick: Record<RivalryKind, Pair | null> = { dupla: partner, carrasco: nemesis, fregues: victim }
  const shown = open ? pick[open] : null
  return (
    <section className="stack">
      {open && shown && (
        <ShareArt title={open === 'dupla' ? 'Dupla de ouro' : open === 'carrasco' ? 'Carrasco' : 'Freguês'} file={`marditos-${open}-${shown.name.toLowerCase()}`} onClose={() => setOpen(null)}>
          <RivalryArt kind={open} me={me} other={{ name: shown.name, avatar: h.avatars[shown.id] }} games={shown.games} wins={shown.wins} losses={shown.losses} />
        </ShareArt>
      )}
      <h2 className="h-title">Duplas e rivalidades</h2>
      <div className="grid3">
        <PairCard label={self ? 'Sua dupla' : 'Melhor dupla'} hint="Jogue mais juntos" p={partner} stat={(p) => `${plural(p.wins, 'vitória', 'vitórias')} em ${p.games} juntos`} onOpen={() => setOpen('dupla')} />
        <PairCard label={self ? 'Seu carrasco' : 'Carrasco'} hint="Ninguém ainda" p={nemesis} stat={(p) => `${plural(p.losses, 'derrota', 'derrotas')} em ${p.games}`} onOpen={() => setOpen('carrasco')} />
        <PairCard label={self ? 'Seu freguês' : 'Freguês'} hint="Ninguém ainda" p={victim} stat={(p) => `${plural(p.wins, 'vitória', 'vitórias')} em ${p.games}`} onOpen={() => setOpen('fregues')} />
      </div>
      <p className="caption muted" style={{ margin: 0 }}>Contam jogos pelo app, a partir de 2 partidas com ou contra a pessoa. Toque para gerar a arte e mandar no grupo.</p>
    </section>
  )
}

export function Badges({ playerId }: { playerId: string }) {
  const h = useHistory()
  if (!h) return null
  const list = badgesOf(h, playerId)
  const n = list.filter((b) => b.unlocked).length
  return (
    <section className="stack">
      <div className="between">
        <h2 className="h-title">Conquistas</h2>
        <span className="caption muted">{n} de {list.length}</span>
      </div>
      <div className="grid2" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        {list.map((b) => <BadgeTile key={b.id} b={b} />)}
      </div>
    </section>
  )
}
