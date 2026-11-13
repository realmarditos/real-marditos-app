/**
 * Estatísticas calculadas a partir do histórico: conquistas, duplas e rivalidades, retrospectiva.
 * Tudo sai das partidas encerradas, das escalações (quem jogou em qual time) e das votações fechadas.
 */
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { AvatarOptions, Match, Team, VoteWinner } from './types'

export type Result = 'V' | 'E' | 'D'
export type Game = { match: Match; team: Team; result: Result }
export type Lineup = { match_id: string; player_id: string; team: Team }
export type History = {
  matches: Match[] // encerradas, da mais antiga para a mais nova
  lineups: Lineup[]
  winners: VoteWinner[]
  names: Record<string, string>
  avatars: Record<string, AvatarOptions | null>
  guests: Set<string>
}

export function useHistory() {
  const [h, setH] = useState<History | null>(null)
  useEffect(() => {
    Promise.all([
      supabase.from('matches').select('*').eq('status', 'encerrada').order('date'),
      supabase.from('attendances').select('match_id,player_id,team,played').eq('played', true).not('team', 'is', null),
      supabase.rpc('vote_winners'),
      supabase.from('players').select('id,name,is_guest,avatar'),
    ]).then(([{ data: m }, { data: a }, { data: w }, { data: p }]) => {
      const ps = (p as { id: string; name: string; is_guest: boolean; avatar: AvatarOptions | null }[]) ?? []
      setH({
        matches: ((m as Match[]) ?? []).filter((x) => x.score_preto != null && x.score_branco != null),
        lineups: (a as Lineup[]) ?? [],
        winners: (w as VoteWinner[]) ?? [],
        names: Object.fromEntries(ps.map((x) => [x.id, x.name])),
        avatars: Object.fromEntries(ps.map((x) => [x.id, x.avatar])),
        guests: new Set(ps.filter((x) => x.is_guest).map((x) => x.id)),
      })
    })
  }, [])
  return h
}

const resultFor = (m: Match, team: Team): Result =>
  m.score_preto === m.score_branco ? 'E' : (team === 'preto') === (m.score_preto! > m.score_branco!) ? 'V' : 'D'

export function gamesOf(h: History, pid: string, year?: number): Game[] {
  const byMatch = new Map(h.matches.map((m) => [m.id, m]))
  return h.lineups
    .filter((l) => l.player_id === pid && byMatch.has(l.match_id))
    .map((l) => ({ match: byMatch.get(l.match_id)!, team: l.team, result: resultFor(byMatch.get(l.match_id)!, l.team) }))
    .filter((g) => !year || Number(g.match.date.slice(0, 4)) === year)
    .sort((a, b) => a.match.date.localeCompare(b.match.date))
}

export function bestWinStreak(games: Game[]) {
  let best = 0, cur = 0
  for (const g of games) { cur = g.result === 'V' ? cur + 1 : 0; best = Math.max(best, cur) }
  return best
}

export function awardsOf(h: History, pid: string, kind: 'mvp' | 'bagre', year?: number) {
  const dates = new Map(h.matches.map((m) => [m.id, m.date]))
  return h.winners.filter((w) => w.player_id === pid && w.kind === kind && dates.has(w.match_id) && (!year || dates.get(w.match_id)!.startsWith(String(year)))).length
}

// ---------- Duplas e rivalidades ----------
export type Pair = { id: string; name: string; games: number; wins: number; losses: number }

export function rivalries(h: History, pid: string, year?: number) {
  const mine = gamesOf(h, pid, year)
  const mates: Record<string, Pair> = {}
  const opps: Record<string, Pair> = {}
  for (const g of mine) {
    for (const l of h.lineups.filter((x) => x.match_id === g.match.id && x.player_id !== pid)) {
      if (h.guests.has(l.player_id)) continue
      const bucket = l.team === g.team ? mates : opps
      const p = (bucket[l.player_id] ??= { id: l.player_id, name: h.names[l.player_id] ?? '?', games: 0, wins: 0, losses: 0 })
      p.games++
      if (g.result === 'V') p.wins++
      if (g.result === 'D') p.losses++
    }
  }
  const min = 2
  const rate = (p: Pair) => p.wins / p.games
  const partner = Object.values(mates).filter((p) => p.games >= min).sort((a, b) => rate(b) - rate(a) || b.wins - a.wins || b.games - a.games)[0] ?? null
  const nemesis = Object.values(opps).filter((p) => p.losses > p.wins && p.games >= min).sort((a, b) => b.losses / b.games - a.losses / a.games || b.losses - a.losses)[0] ?? null
  const victim = Object.values(opps).filter((p) => p.wins > p.losses && p.games >= min).sort((a, b) => rate(b) - rate(a) || b.wins - a.wins)[0] ?? null
  return { partner, nemesis, victim }
}

// ---------- Conquistas ----------
export type BadgeId = 'invicto' | 'pe_de_rato' | 'rei_da_noite' | 'bagre_de_ouro' | 'veterano'
export type Badge = { id: BadgeId; title: string; level: string | null; unlocked: boolean; detail: string; next: string | null }

const monthKey = (d: string) => d.slice(0, 7)

export function badgesOf(h: History, pid: string): Badge[] {
  const games = gamesOf(h, pid)
  const played = new Set(games.map((g) => g.match.id))

  // Invicto: vitórias seguidas
  const streak = bestWinStreak(games)
  const inv = tier(streak, [[10, 'Ouro'], [5, 'Prata'], [3, 'Bronze']])

  // Pé de rato: mês completo (mês com 2+ jogos, sem faltar) e ano completo (temporada com 10+ jogos)
  const byMonth: Record<string, string[]> = {}
  h.matches.forEach((m) => (byMonth[monthKey(m.date)] ??= []).push(m.id))
  const fullMonths = Object.values(byMonth).filter((ids) => ids.length >= 2 && ids.every((id) => played.has(id))).length
  const year = new Date().getFullYear()
  const seasonIds = h.matches.filter((m) => m.date.startsWith(String(year))).map((m) => m.id)
  const fullYear = seasonIds.length >= 10 && seasonIds.every((id) => played.has(id))

  // Rei da noite: MVPs
  const mvps = awardsOf(h, pid, 'mvp')
  const rei = tier(mvps, [[10, '10 MVPs'], [5, '5 MVPs'], [1, '1º MVP']])

  // Bagre de ouro: quem mais levou bagre em algum mês já encerrado
  const nowKey = monthKey(new Date().toISOString())
  const bagreMonths = Object.keys(byMonth).filter((mk) => mk < nowKey).filter((mk) => {
    const counts: Record<string, number> = {}
    h.winners.filter((w) => w.kind === 'bagre' && byMonth[mk].includes(w.match_id)).forEach((w) => { counts[w.player_id] = (counts[w.player_id] ?? 0) + 1 })
    const max = Math.max(0, ...Object.values(counts))
    return max > 0 && counts[pid] === max
  }).length

  // Veterano: jogos disputados pelo app
  const vet = tier(games.length, [[100, '100 jogos'], [50, '50 jogos']])

  return [
    { id: 'invicto', title: 'Invicto', level: inv, unlocked: !!inv, detail: `Melhor sequência: ${streak} ${streak === 1 ? 'vitória' : 'vitórias'} seguidas`, next: nextOf(streak, [3, 5, 10], 'vitórias seguidas') },
    { id: 'pe_de_rato', title: 'Pé de rato', level: fullYear ? 'Ano completo' : fullMonths ? 'Mês completo' : null, unlocked: fullYear || fullMonths > 0, detail: fullMonths ? `${fullMonths} ${fullMonths === 1 ? 'mês' : 'meses'} sem faltar` : 'Nunca faltar num mês', next: fullYear ? null : fullMonths ? 'Ano sem faltar' : 'Um mês sem faltar' },
    { id: 'rei_da_noite', title: 'Rei da noite', level: rei, unlocked: !!rei, detail: `${mvps} ${mvps === 1 ? 'vez' : 'vezes'} MVP`, next: nextOf(mvps, [1, 5, 10], 'MVPs') },
    { id: 'bagre_de_ouro', title: 'Bagre de ouro', level: bagreMonths ? (bagreMonths > 1 ? `${bagreMonths} meses` : 'Do mês') : null, unlocked: bagreMonths > 0, detail: bagreMonths ? 'Mais votado como bagre no mês' : 'Ser o mais votado bagre de um mês', next: null },
    { id: 'veterano', title: 'Veterano', level: vet, unlocked: !!vet, detail: `${games.length} jogos pelo app`, next: nextOf(games.length, [50, 100], 'jogos') },
  ]
}

function tier(v: number, levels: [number, string][]) {
  return levels.find(([n]) => v >= n)?.[1] ?? null
}
function nextOf(v: number, steps: number[], unit: string) {
  const n = steps.find((s) => v < s)
  return n ? `Próximo: ${n} ${unit}` : null
}

/** "1 vitória", "3 vitórias" */
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
