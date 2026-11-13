/**
 * Sorteio equilibrado dos times Preto e Branco.
 *
 * - Um goleiro em cada time (se houver dois ou mais confirmados).
 * - Jogadores de linha divididos em partes iguais.
 * - Respeita jogadores travados num time e duplas que devem ficar separadas.
 * - Testa milhares de combinações e sorteia entre as mais equilibradas,
 *   para que "Sortear de novo" traga times diferentes.
 */
export type DrawPlayer = { id: string; name: string; rating: number; isGoalkeeper: boolean }
export type TeamKey = 'preto' | 'branco'
export type DrawResult = { preto: DrawPlayer[]; branco: DrawPlayer[]; avgPreto: number; avgBranco: number; diff: number; violations: number }

export type DrawOptions = {
  locks?: Record<string, TeamKey>
  separations?: [string, string][]
  iterations?: number
  tolerance?: number
  random?: () => number
}

const avg = (ps: DrawPlayer[]) => (ps.length ? ps.reduce((s, p) => s + p.rating, 0) / ps.length : 0)

function shuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function drawTeams(players: DrawPlayer[], opts: DrawOptions = {}): DrawResult {
  const rnd = opts.random ?? Math.random
  const locks = opts.locks ?? {}
  const seps = opts.separations ?? []
  const iterations = opts.iterations ?? 4000
  const tolerance = opts.tolerance ?? 0.15

  // Goleiros: os dois melhores vão um para cada lado; extras jogam na linha
  const gks = players.filter((p) => p.isGoalkeeper).sort((a, b) => b.rating - a.rating)
  const fixedGk: Record<TeamKey, DrawPlayer[]> = { preto: [], branco: [] }
  const line: DrawPlayer[] = players.filter((p) => !p.isGoalkeeper)
  if (gks.length >= 2) {
    const [g1, g2] = gks
    // Respeita trava de goleiro se houver
    if (locks[g1.id] === 'branco' || locks[g2.id] === 'preto') { fixedGk.branco.push(g1); fixedGk.preto.push(g2) }
    else { fixedGk.preto.push(g1); fixedGk.branco.push(g2) }
    line.push(...gks.slice(2))
  } else {
    line.push(...gks)
  }

  const total = players.length
  const sizePreto = Math.ceil(total / 2)

  const candidates: { res: DrawResult; score: number }[] = []
  let best = Infinity

  for (let it = 0; it < iterations; it++) {
    const preto = [...fixedGk.preto]
    const branco = [...fixedGk.branco]
    const free: DrawPlayer[] = []
    for (const p of line) {
      if (locks[p.id] === 'preto') preto.push(p)
      else if (locks[p.id] === 'branco') branco.push(p)
      else free.push(p)
    }
    // Preenche o Preto até o tamanho dele; o resto vai para o Branco
    for (const p of shuffle(free, rnd)) {
      if (preto.length < sizePreto) preto.push(p)
      else branco.push(p)
    }
    const inPreto = new Set(preto.map((p) => p.id))
    const present = new Set(players.map((p) => p.id))
    let violations = 0
    for (const [a, b] of seps) {
      if (present.has(a) && present.has(b) && inPreto.has(a) === inPreto.has(b)) violations++
    }
    const avgPreto = avg(preto)
    const avgBranco = avg(branco)
    const diff = Math.abs(avgPreto - avgBranco)
    const score = diff + violations * 100 + Math.abs(preto.length - branco.length) * 10
    candidates.push({ res: { preto, branco, avgPreto, avgBranco, diff, violations }, score })
    if (score < best) best = score
  }

  const good = candidates.filter((c) => c.score <= best + tolerance)
  const chosen = good[Math.floor(rnd() * good.length)].res
  const byRating = (a: DrawPlayer, b: DrawPlayer) => Number(b.isGoalkeeper) - Number(a.isGoalkeeper) || b.rating - a.rating
  return { ...chosen, preto: chosen.preto.slice().sort(byRating), branco: chosen.branco.slice().sort(byRating) }
}

export function overall(r: { tecnica: number; fisico: number; marcacao: number; finalizacao: number } | undefined): number {
  if (!r) return 5
  return (r.tecnica + r.fisico + r.marcacao + r.finalizacao) / 4
}
