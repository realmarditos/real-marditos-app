import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { RankingRow } from '../lib/types'
import { Avatar, Icon, RoleTag } from '../components/ui'
import ShareArt from '../components/ShareArt'
import { RankingArt } from '../components/Arts'
import { IMG } from '../lib/assets'

export default function Ranking() {
  const { player } = useAuth()
  const nav = useNavigate()
  const [rows, setRows] = useState<RankingRow[] | null>(null)
  const [sharing, setSharing] = useState(false)
  const [roles, setRoles] = useState<Record<string, string>>({})
  const season = new Date().getFullYear()

  useEffect(() => {
    supabase.rpc('ranking').then(({ data }) => setRows((data as RankingRow[]) ?? []))
    supabase.from('players').select('id,role').neq('role', 'membro').then(({ data }) => setRoles(Object.fromEntries(((data as { id: string; role: string }[]) ?? []).map((p) => [p.id, p.role]))))
  }, [])

  if (!rows) return <main className="screen"><p className="muted">Carregando ranking…</p></main>
  const [first, second, third] = rows
  const rest = rows.slice(3)

  return (
    <main className="screen">
      <header className="between" style={{ alignItems: 'flex-end' }}>
        <div>
          <p className="eyebrow">Temporada {season}</p>
          <h1 className="h-xl" style={{ marginTop: 2 }}>Ranking</h1>
        </div>
        {rows.length > 0 && (
          <button className="btn sm gold pill" onClick={() => setSharing(true)} aria-label="Mandar o ranking no WhatsApp">
            <Icon name="whatsapp" size={18} />Compartilhar
          </button>
        )}
      </header>
      {sharing && (
        <ShareArt title="Ranking para o grupo" file={`ranking-marditos-${season}`} text={`Ranking Real Marditos ${season}`} onClose={() => setSharing(false)}>
          <RankingArt rows={rows} season={season} />
        </ShareArt>
      )}

      {first && (
        <section className="card lg stripes" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 8, paddingBottom: 0 }}>
          {[second, first, third].map((r, i) => {
            if (!r) return <div key={i} style={{ flex: 1 }} />
            const pos = r === first ? 1 : r === second ? 2 : 3
            const h = pos === 1 ? 84 : pos === 2 ? 64 : 48
            return (
              <div key={r.player_id} className="stack" role="link" tabIndex={0} onClick={() => nav(`/jogador/${r.player_id}`)} onKeyDown={(e) => e.key === 'Enter' && nav(`/jogador/${r.player_id}`)} style={{ flex: 1, alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                {pos === 1 && <img src={IMG.coroa} alt="Coroa do líder" style={{ width: 44, marginBottom: -4 }} />}
                <Avatar avatar={r.avatar} seed={r.name} alt={r.name} />
                <p className="small" style={{ margin: 0, fontWeight: 600 }}>{r.name}</p>
                <RoleTag role={roles[r.player_id]} />
                <div style={{ width: '100%', height: h, background: pos === 1 ? 'var(--brand-blue)' : 'var(--surface-raised)', borderRadius: '12px 12px 0 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: pos === 1 ? 28 : 22 }}>{pos}º</p>
                  <p className="caption" style={{ margin: 0, color: pos === 1 ? 'var(--ink)' : 'var(--ink-muted)' }}>{r.points} pts</p>
                </div>
              </div>
            )
          })}
        </section>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '26px 1fr 26px 26px 40px', gap: 8, padding: '0 12px' }} className="eyebrow">
        <span>#</span><span>Jogador</span><span style={{ textAlign: 'center' }}>J</span><span style={{ textAlign: 'center' }}>V</span><span style={{ textAlign: 'right' }}>Pts</span>
      </div>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rest.map((r, i) => {
          const me = r.player_id === player?.id
          return (
            <li key={r.player_id} onClick={() => nav(`/jogador/${r.player_id}`)} style={{ cursor: 'pointer', display: 'grid', gridTemplateColumns: '26px 1fr 26px 26px 40px', gap: 8, alignItems: 'center', minHeight: 48, padding: '4px 12px', background: me ? 'var(--surface-raised)' : 'var(--surface)', borderRadius: 12 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 17, color: 'var(--ink-muted)' }}>{i + 4}</span>
              <span className="row" style={{ gap: 6, fontWeight: 500, minWidth: 0, overflow: 'hidden' }}>
                <Avatar avatar={r.avatar} seed={r.name} size="sm" />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 44, flex: '0 1 auto' }}>{r.name}</span>
                <RoleTag role={roles[r.player_id]} />
                {r.is_goalkeeper && <span className="caption muted">GOL</span>}
                {r.mvps > 0 && <span className="caption gold-text" title="MVPs" style={{ flex: '0 0 auto' }}>★{r.mvps}</span>}
              </span>
              <span className="small muted" style={{ textAlign: 'center' }}>{r.games}</span>
              <span className="small muted" style={{ textAlign: 'center' }}>{r.wins}</span>
              <span style={{ textAlign: 'right', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--gold-text)' }}>{r.points}</span>
            </li>
          )
        })}
      </ol>
      <p className="caption muted" style={{ margin: 0 }}>J e V contam a partir do lançamento do app. Os pontos já incluem o ranking de antes. ★ = MVPs. Toque num jogador para ver o card.</p>
    </main>
  )
}
