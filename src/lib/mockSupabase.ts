/**
 * MODO DEMO: imita o Supabase dentro do navegador, para testar o app sem servidor.
 * Os dados ficam no localStorage (quando disponível) ou só na memória.
 * Implementa apenas o que o app usa: from().select/insert/update/upsert/delete com filtros, rpc() e auth.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>
type DB = Record<string, Row[]> & { _users: Row[] }

const KEY = 'marditos-demo-v13'
export const DEMO_CODE = 'MARDITOS'
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

const PK: Record<string, string[]> = {
  players: ['id'], player_ratings: ['player_id'], matches: ['id'], attendances: ['match_id', 'player_id'],
  announcements: ['id'], draw_separations: ['id'], club_settings: ['id'], votes: ['match_id', 'voter_id', 'kind'], dues: ['id'], cash_moves: ['id'], cash_reports: ['month'], match_reactions: ['match_id', 'player_id', 'emoji'], event_rsvps: ['event_id', 'player_id'], match_comments: ['id'], events: ['id'], match_awards: ['match_id', 'kind', 'player_id'],
}

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function seedDues(players: Row[], now: Date): Row[] {
  const out: Row[] = []
  const months = [iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), iso(new Date(now.getFullYear(), now.getMonth(), 1))]
  const unpaidPrev = ['Pelence', 'Pereira']
  const paidNow = ['Pedro', 'Daniel', 'Kaique', 'Nadabe', 'Bertoldi', 'Buse', 'Junior', 'Censi', 'Anderson']
  for (const p of players.filter((x) => !x.is_guest)) {
    const amount = p.is_goalkeeper || p.status === 'afastado' ? 15 : 50
    out.push({ id: 'd-' + uid(), player_id: p.id, month: months[0], amount, status: unpaidPrev.includes(p.name) ? 'pendente' : 'pago', receipt_path: null, informed_at: null, paid_at: unpaidPrev.includes(p.name) ? null : months[0] + 'T12:00:00', confirmed_by: null })
    const st = paidNow.includes(p.name) ? 'pago' : p.name === 'Walison' ? 'informado' : 'pendente'
    out.push({ id: 'd-' + uid(), player_id: p.id, month: months[1], amount, status: st, receipt_path: null, informed_at: st === 'informado' ? now.toISOString() : null, paid_at: st === 'pago' ? now.toISOString() : null, confirmed_by: null })
  }
  return out
}

function seed(): DB {
  const names: [string, boolean, number][] = [
    ['Japa', false, 120], ['Daniel', false, 101], ['Kaique', false, 97], ['Nadabe', false, 96], ['Walison', false, 79],
    ['Bertoldi', false, 77], ['Buse', false, 74], ['Anderson', false, 54], ['Censi', false, 53], ['Pedro', false, 45],
    ['Ian', false, 39], ['Junior', false, 36], ['Itália', true, 28], ['Pereira', true, 15], ['Sansão', false, 13],
    ['Pelence', false, 10], ['Vini', false, 1],
  ]
  const players: Row[] = names.map(([name, gk, pts]) => ({
    id: 'p-' + name.toLowerCase().normalize('NFD').replace(/[^a-z]/g, ''), user_id: null, name, phone: null,
    position: gk ? 'Goleiro' : null, is_goalkeeper: gk, foot: null, shirt_number: null, birthday: null,
    status: 'ativo', role: 'membro', avatar: null, initial_points: pts, is_guest: false, created_at: new Date().toISOString(),
  }))
  // Duas contas prontas para testar
  const users = [
    { id: 'u-pedro', email: 'pedro@marditos.app', password: 'rm-1234-marditos' },
    { id: 'u-japa', email: 'japa@marditos.app', password: 'rm-1234-marditos' },
  ]
  players.push({ id: 'g-tiago', user_id: null, name: 'Tiago', phone: null, position: null, is_goalkeeper: false, foot: null, shirt_number: null, birthday: null, status: 'ativo', role: 'membro', avatar: null, initial_points: 0, is_guest: true, created_at: new Date().toISOString() })
  const pedro = players.find((p) => p.name === 'Pedro')!
  Object.assign(pedro, { user_id: 'u-pedro', role: 'presidente', position: 'Meio', foot: 'Destro', shirt_number: 10 })
  Object.assign(players.find((p) => p.name === 'Japa')!, { user_id: 'u-japa' })
  // As contas prontas já montaram o perfil; quem criar conta nova passa pela tela de boas-vindas
  pedro.avatar = { v: 4, skin: 1, hair: 'topete', hairColor: 1, eyes: 'normal', brows: 'normal', mouth: 'canto', beard: 'por fazer', glasses: 'nenhum', hat: 'nenhum', extra: 'nenhum', shirt: 'titular' }
  players.find((p) => p.name === 'Japa')!.avatar = { v: 4, skin: 3, hair: 'espetado', hairColor: 0, eyes: 'piscando', brows: 'erguida', mouth: 'risada', beard: 'nenhuma', glasses: 'nenhum', hat: 'boné pra trás', extra: 'nenhum', shirt: 'titular' }
  Object.assign(players.find((p) => p.name === 'Daniel')!, { role: 'tesoureiro' })

  const notes: Record<string, number[]> = {
    Japa: [9, 8, 7, 9], Daniel: [8, 8, 7, 8], Kaique: [8, 7, 8, 7], Nadabe: [7, 8, 7, 7], Walison: [7, 7, 7, 7],
    Bertoldi: [7, 7, 8, 6], Buse: [7, 7, 7, 6], Anderson: [8, 7, 6, 8], Censi: [6, 7, 7, 6], Pedro: [7, 6, 7, 6],
    Ian: [7, 6, 6, 7], Junior: [6, 7, 6, 6], 'Itália': [7, 7, 8, 5], Pereira: [7, 6, 8, 5], 'Sansão': [6, 6, 6, 6],
    Pelence: [6, 6, 5, 6], Vini: [5, 6, 6, 5],
  }
  const ratings = players.map((p) => {
    const [t, f, m, fi] = notes[p.name] ?? [6, 6, 6, 6]
    return { player_id: p.id, tecnica: t, fisico: f, marcacao: m, finalizacao: fi, updated_at: new Date().toISOString() }
  })

  const now = new Date()
  const nextThu = new Date(now); nextThu.setDate(now.getDate() + ((4 - now.getDay() + 7) % 7))
  const lastThu = new Date(nextThu); lastThu.setDate(nextThu.getDate() - 7)
  const prevThu = new Date(lastThu); prevThu.setDate(lastThu.getDate() - 7)
  const mk = (id: string, d: Date, status: string, sp: number | null, sb: number | null) => ({
    id, date: iso(d), starts_at: '19:00:00', ends_at: '20:00:00', venue: 'Lince Arena', status, score_preto: sp, score_branco: sb, photo_url: null, created_at: d.toISOString(),
  })
  const matches = [mk('m-prev', prevThu, 'encerrada', 4, 6), mk('m-last', lastThu, 'encerrada', 7, 5), mk('m-next', nextThu, 'aberta', null, null)]

  const pid = (n: string) => players.find((p) => p.name === n)!.id
  const att: Row[] = []
  const lineup = (mid: string, preto: string[], branco: string[]) => {
    preto.forEach((n) => att.push({ match_id: mid, player_id: pid(n), rsvp: 'vou', rsvp_at: new Date().toISOString(), team: 'preto', is_reserve: false, played: true }))
    branco.forEach((n) => att.push({ match_id: mid, player_id: pid(n), rsvp: 'vou', rsvp_at: new Date().toISOString(), team: 'branco', is_reserve: false, played: true }))
  }
  lineup('m-prev', ['Itália', 'Japa', 'Buse', 'Censi', 'Ian', 'Junior'], ['Pereira', 'Daniel', 'Kaique', 'Walison', 'Pedro', 'Bertoldi'])
  lineup('m-last', ['Itália', 'Anderson', 'Japa', 'Walison', 'Censi', 'Ian'], ['Pereira', 'Daniel', 'Kaique', 'Nadabe', 'Pedro', 'Bertoldi'])
  const vote = (mid: string, voter: string, kind: string, target: string) => ({ match_id: mid, voter_id: pid(voter), kind, target_id: pid(target), created_at: new Date().toISOString() })
  const seedVotes = [
    vote('m-prev', 'Japa', 'mvp', 'Kaique'), vote('m-prev', 'Pedro', 'mvp', 'Kaique'), vote('m-prev', 'Daniel', 'mvp', 'Japa'),
    vote('m-prev', 'Japa', 'bagre', 'Ian'), vote('m-prev', 'Kaique', 'bagre', 'Ian'),
    vote('m-last', 'Japa', 'mvp', 'Anderson'), vote('m-last', 'Pedro', 'mvp', 'Anderson'), vote('m-last', 'Walison', 'mvp', 'Anderson'), vote('m-last', 'Daniel', 'mvp', 'Kaique'),
    vote('m-last', 'Anderson', 'bagre', 'Censi'), vote('m-last', 'Japa', 'bagre', 'Censi'), vote('m-last', 'Pedro', 'bagre', 'Bertoldi'),
  ]
  // Mais 8 quintas de histórico (geradas de forma fixa) para conquistas, rivalidades e retrospectiva
  let seedN = 7
  const rnd = () => { seedN = (seedN * 9301 + 49297) % 233280; return seedN / 233280 }
  const regulars = ['Japa', 'Daniel', 'Kaique', 'Nadabe', 'Walison', 'Bertoldi', 'Buse', 'Anderson', 'Censi', 'Pedro', 'Ian', 'Junior']
  for (let k = 1; k <= 8; k++) {
    const d = new Date(prevThu); d.setDate(prevThu.getDate() - 7 * k)
    if (d.getFullYear() !== now.getFullYear()) break
    const id = 'm-h' + k
    const pool = regulars.filter((n) => n === 'Japa' || rnd() > 0.2).slice(0, 10)
    const shuffled = pool.map((n) => [rnd(), n] as [number, string]).sort((a, b) => a[0] - b[0]).map((x) => x[1])
    const half = Math.ceil(shuffled.length / 2)
    const preto = ['Itália', ...shuffled.slice(0, half)], branco = ['Pereira', ...shuffled.slice(half)]
    const sp = Math.floor(rnd() * 7), sb = Math.floor(rnd() * 7)
    matches.unshift(mk(id, d, 'encerrada', sp, sb))
    lineup(id, preto, branco)
    const winners = sp === sb ? [...preto, ...branco] : sp > sb ? preto : branco
    const losers = sp === sb ? [...preto, ...branco] : sp > sb ? branco : preto
    const mvp = winners.filter((n) => !['Itália', 'Pereira'].includes(n))[Math.floor(rnd() * (winners.length - 1))] ?? winners[0]
    const bagre = losers[Math.floor(rnd() * losers.length)]
    ;['Japa', 'Pedro', 'Daniel'].forEach((v) => { seedVotes.push(vote(id, v, 'mvp', mvp)); seedVotes.push(vote(id, v, 'bagre', bagre)) })
  }

  // Os pontos iniciais já incluem essas duas noites: desconta para o total bater com o ranking real
  const confirmados = ['Japa', 'Daniel', 'Kaique', 'Nadabe', 'Walison', 'Anderson', 'Censi', 'Itália', 'Pereira']
  confirmados.forEach((n, i) => att.push({ match_id: 'm-next', player_id: pid(n), rsvp: 'vou', rsvp_at: new Date(Date.now() - (20 - i) * 60000).toISOString(), team: null, is_reserve: false, played: false }))
  att.push({ match_id: 'm-next', player_id: pid('Vini'), rsvp: 'nao_vou', rsvp_at: new Date().toISOString(), team: null, is_reserve: false, played: false })

  const db: DB = {
    _users: users,
    club_settings: [{ id: 1, club_code: DEMO_CODE, season: now.getFullYear(), confirm_deadline: '14:00:00', max_players: 12, pts_win: 3, pts_draw: 1, pts_loss: 0, pts_presence: 1, pts_mvp: 1, fee_line: 50, fee_goalkeeper: 15, fee_away: 15, due_day: 10, reminder_day: 5, pix_key: 'realmarditos@gmail.com', pix_name: 'REAL MARDITOS FC', pix_city: 'GASPAR', opening_balance: 0 }],
    players, player_ratings: ratings, matches, attendances: att,
    announcements: [{ id: 'a1', body: 'Bem-vindos ao app do Real Marditos! Esta é a versão de teste.', pinned: true, created_at: new Date().toISOString(), created_by: pedro.id }],
    draw_separations: [{ id: 's1', player_a: pid('Japa'), player_b: pid('Daniel') }],
    votes: seedVotes,
    dues: seedDues(players, now),
    cash_moves: [
      { id: 'c1', kind: 'saida', category: 'Quadra', amount: 320, date: iso(new Date(now.getFullYear(), now.getMonth(), 2)), description: 'Lince Arena (valor de exemplo)', created_at: now.toISOString() },
      { id: 'c2', kind: 'saida', category: 'Bola', amount: 120, date: iso(new Date(now.getFullYear(), now.getMonth() - 1, 15)), description: 'Bola nova (valor de exemplo)', created_at: now.toISOString() },
      { id: 'c3', kind: 'saida', category: 'Quadra', amount: 320, date: iso(new Date(now.getFullYear(), now.getMonth() - 1, 2)), description: 'Lince Arena (valor de exemplo)', created_at: now.toISOString() },
    ],
  } as DB
  // Ajusta pontos iniciais para que o total exibido seja o ranking real
  const tmp = rankingRows(db)
  for (const r of tmp) {
    const p = db.players.find((x) => x.id === r.player_id)!
    p.initial_points -= r.points - p.initial_points
  }
  // Aniversários (datas de exemplo): um hoje e dois ainda neste mês
  const bday = (n: string, day: number) => { const p = db.players.find((x) => x.name === n); if (p) p.birthday = `1995-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` }
  bday('Kaique', now.getDate()); bday('Nadabe', Math.min(28, now.getDate() + 6)); bday('Ian', Math.max(1, now.getDate() - 4))
  // Feed da última noite
  db.match_comments = [
    { id: 'mc1', match_id: 'm-last', player_id: pid('Japa'), body: 'Anderson jogou demais, MVP merecido', created_at: new Date(Date.now() - 6 * 86400000).toISOString() },
    { id: 'mc2', match_id: 'm-last', player_id: pid('Censi'), body: 'Bagre é perseguição 😂', created_at: new Date(Date.now() - 6 * 86400000 + 3600000).toISOString() },
  ]
  db.match_reactions = [
    ...['Japa', 'Pedro', 'Walison', 'Anderson'].map((n) => ({ match_id: 'm-last', player_id: pid(n), emoji: '🔥', created_at: now.toISOString() })),
    ...['Kaique', 'Daniel'].map((n) => ({ match_id: 'm-last', player_id: pid(n), emoji: '😂', created_at: now.toISOString() })),
    { match_id: 'm-last', player_id: pid('Anderson'), emoji: '🐟', created_at: now.toISOString() },
  ]
  // Evento: encerramento
  db.events = [{ id: 'e1', title: 'Encerramento da temporada', description: 'Churrasco de fim de ano da patota. Traga a família!', date: `${now.getFullYear()}-12-03`, time: '19:00:00', place: null, price: null, created_by: pedro.id, created_at: now.toISOString() }]
  db.event_rsvps = ['Japa', 'Daniel', 'Kaique', 'Walison', 'Buse'].map((n, i) => ({ event_id: 'e1', player_id: pid(n), rsvp: 'vou', guests: i % 2, updated_at: now.toISOString() }))
  db.event_rsvps.push({ event_id: 'e1', player_id: pid('Vini'), rsvp: 'nao_vou', guests: 0, updated_at: now.toISOString() })

  // Prestação de contas do mês passado já publicada
  const prev = iso(new Date(now.getFullYear(), now.getMonth() - 1, 1))
  db.match_awards = []
  db.cash_reports = [{ id: 'r1', month: prev, period_end: prev, ...monthSummary(db, prev), notes: 'Bola nova comprada. Valores de exemplo da demo.', published_at: new Date(now.getFullYear(), now.getMonth(), 3, 20).toISOString(), published_by: 'p-daniel' }]
  return db
}

let mem: DB | null = null
function load(): DB {
  if (mem) return mem
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) { mem = JSON.parse(raw); return mem! }
  } catch { /* sem localStorage */ }
  mem = seed()
  save()
  return mem
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(mem)) } catch { /* ignora */ }
}
export function resetDemo() {
  mem = seed(); save()
  try { localStorage.removeItem(KEY + '-session') } catch { /* */ }
}

// ---------- Auth ----------
type Listener = (e: string, s: any) => void
const listeners = new Set<Listener>()
let session: any = null
try { const s = localStorage.getItem(KEY + '-session'); if (s) session = JSON.parse(s) } catch { /* */ }
function setSession(s: any) {
  session = s
  try { s ? localStorage.setItem(KEY + '-session', JSON.stringify(s)) : localStorage.removeItem(KEY + '-session') } catch { /* */ }
  listeners.forEach((l) => l(s ? 'SIGNED_IN' : 'SIGNED_OUT', s))
}
const makeSession = (u: Row) => ({ access_token: 'demo', user: { id: u.id, email: u.email } })
const me = () => (session ? load().players.find((p) => p.user_id === session.user.id) : undefined)
const err = (message: string) => ({ data: null, error: { message } })

export function demoLoginAs(userId: string) {
  const u = load()._users.find((x) => x.id === userId)
  if (u) setSession(makeSession(u))
}

const auth = {
  async getSession() { return { data: { session }, error: null } },
  onAuthStateChange(cb: Listener) { listeners.add(cb); return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } } },
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    const u = load()._users.find((x) => x.email === email && x.password === password)
    if (!u) return err('Invalid login credentials')
    setSession(makeSession(u)); return { data: { session }, error: null }
  },
  async signUp({ email, password, options }: any) {
    const db = load()
    if (db._users.some((x) => x.email === email)) return err('User already registered')
    if (password.length < 6) return err('Password should be at least 6 characters')
    if (String(options?.data?.club_code ?? '').trim().toLowerCase() !== db.club_settings[0].club_code.toLowerCase()) return err('Database error saving new user')
    const u = { id: 'u-' + uid(), email, password }
    db._users.push(u); save(); setSession(makeSession(u))
    return { data: { session }, error: null }
  },
  async signOut() { setSession(null); return { error: null } },
  async updateUser({ password }: { password: string }) {
    const u = session && load()._users.find((x) => x.id === session.user.id)
    if (!u) return err('Faça login primeiro')
    u.password = password; save(); return { data: { user: session.user }, error: null }
  },
}

// ---------- Votação (mesma regra do SQL) ----------
export function voteDeadline(match: Row): Date {
  return new Date(new Date(`${match.date}T${String(match.ends_at).slice(0, 8)}-03:00`).getTime() + 24 * 3600 * 1000)
}
function voteWinners(db: DB) {
  const out: Row[] = []
  for (const mt of db.matches) {
    if (mt.status !== 'encerrada' || Date.now() <= voteDeadline(mt).getTime()) continue
    for (const kind of ['mvp', 'bagre']) {
      const c: Record<string, number> = {}
      db.votes.filter((v) => v.match_id === mt.id && v.kind === kind).forEach((v) => { c[v.target_id] = (c[v.target_id] ?? 0) + 1 })
      const max = Math.max(0, ...Object.values(c))
      Object.entries(c).filter(([, n]) => n === max && n > 0).forEach(([player_id, n]) => out.push({ match_id: mt.id, kind, player_id, votes: n }))
    }
  }
  // Ninguém votou: vale a escolha da diretoria
  for (const a of db.match_awards ?? []) {
    const mt = db.matches.find((x) => x.id === a.match_id)
    if (mt?.status === 'encerrada' && !db.votes.some((v) => v.match_id === a.match_id && v.kind === a.kind)) out.push({ ...a, votes: 0 })
  }
  return out
}

// ---------- Ranking (mesma regra do SQL) ----------
function rankingRows(db: DB) {
  const s = db.club_settings[0]
  const res = db.attendances.flatMap((a) => {
    const m = db.matches.find((x) => x.id === a.match_id)
    if (!m || m.status !== 'encerrada' || !a.played || !a.team || m.score_preto == null || m.score_branco == null) return []
    if (Number(m.date.slice(0, 4)) !== s.season) return []
    const r = m.score_preto === m.score_branco ? 'E' : (a.team === 'preto') === (m.score_preto > m.score_branco) ? 'V' : 'D'
    return [{ pid: a.player_id, r }]
  })
  const wins = voteWinners(db).filter((w) => Number(db.matches.find((x) => x.id === w.match_id)!.date.slice(0, 4)) === s.season)
  return db.players.filter((p) => !p.is_guest && p.approved !== false).map((p) => {
    const mine = res.filter((x) => x.pid === p.id)
    const pts = mine.reduce((t, x) => t + s.pts_presence + (x.r === 'V' ? s.pts_win : x.r === 'E' ? s.pts_draw : s.pts_loss), 0)
    const mvps = wins.filter((w) => w.kind === 'mvp' && w.player_id === p.id).length
    const bagres = wins.filter((w) => w.kind === 'bagre' && w.player_id === p.id).length
    return {
      player_id: p.id, name: p.name, avatar: p.avatar, is_goalkeeper: p.is_goalkeeper, status: p.status,
      points: p.initial_points + pts + mvps * s.pts_mvp, games: mine.length, mvps, bagres,
      wins: mine.filter((x) => x.r === 'V').length, draws: mine.filter((x) => x.r === 'E').length, losses: mine.filter((x) => x.r === 'D').length,
    }
  }).sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
}

// ---------- Prestação de contas (mesma regra do SQL) ----------
function monthSummary(db: DB, p_month: string, p_end?: string | null) {
  const m0 = p_month.slice(0, 8) + '01'
  const e0 = (p_end ?? p_month).slice(0, 8) + '01'
  const d1 = new Date(Number(e0.slice(0, 4)), Number(e0.slice(5, 7)), 1)
  const m1 = iso(d1)
  const t0 = new Date(m0 + 'T00:00:00-03:00').getTime(), t1 = new Date(m1 + 'T00:00:00-03:00').getTime()
  const paidAt = (d: Row) => (d.paid_at ? new Date(d.paid_at).getTime() : 0)
  const sum = (rows: Row[]) => rows.reduce((t, r) => t + Number(r.amount), 0)
  const s = db.club_settings[0]
  const paid = db.dues.filter((d) => d.status === 'pago')
  const opening = Number(s.opening_balance) + sum(paid.filter((d) => paidAt(d) < t0))
    + sum(db.cash_moves.filter((c) => c.kind === 'entrada' && c.date < m0)) - sum(db.cash_moves.filter((c) => c.kind === 'saida' && c.date < m0))
  const dues_in = sum(paid.filter((d) => paidAt(d) >= t0 && paidAt(d) < t1))
  const inMonth = db.cash_moves.filter((c) => c.date >= m0 && c.date < m1)
  const income = sum(inMonth.filter((c) => c.kind === 'entrada'))
  const expenses = sum(inMonth.filter((c) => c.kind === 'saida'))
  const cats: Record<string, number> = {}
  inMonth.filter((c) => c.kind === 'saida').forEach((c) => { cats[c.category] = (cats[c.category] ?? 0) + Number(c.amount) })
  const md = db.dues.filter((d) => d.month >= m0 && d.month < m1)
  return {
    opening, dues_in, income, expenses, closing: opening + dues_in + income - expenses,
    by_category: Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([category, amount]) => ({ category, amount })),
    paid_count: md.filter((d) => d.status === 'pago').length, total_count: md.length,
  }
}

// ---------- RPC ----------
const rpcs: Record<string, (a: any) => any> = {
  verify_club_code: ({ code }) => ({ data: String(code).trim().toLowerCase() === load().club_settings[0].club_code.toLowerCase(), error: null }),
  get_club_code: () => (me()?.role === 'presidente' ? { data: load().club_settings[0].club_code, error: null } : err('Só o presidente vê o código do clube')),
  unclaimed_players: () => ({ data: me() ? [] : load().players.filter((p) => !p.user_id && !p.is_guest).map((p) => ({ id: p.id, name: p.name })).sort((a, b) => a.name.localeCompare(b.name)), error: null }),
  claim_player: ({ pid }) => {
    if (!session) return err('Faça login primeiro')
    if (me()) return err('Sua conta já está vinculada')
    const p = load().players.find((x) => x.id === pid && !x.user_id && !x.is_guest)
    if (!p) return err('Esse jogador já foi escolhido por outra conta')
    p.user_id = session.user.id; p.approved = p.role === 'presidente'; save()
    return { data: null, error: null }
  },
  join_as_new_player: ({ player_name }) => {
    if (!session) return err('Faça login primeiro')
    if (me()) return err('Sua conta já está vinculada')
    const db = load()
    const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
    if (db.players.some((x) => !x.is_guest && norm(x.name) === norm(String(player_name)))) return err('duplicate key value violates unique constraint "players_name_unique"')
    const p = { id: 'p-' + uid(), user_id: session.user.id, name: String(player_name).trim(), phone: null, position: null, is_goalkeeper: false, foot: null, shirt_number: null, birthday: null, status: 'ativo', role: 'membro', avatar: null, initial_points: 0, is_guest: false, approved: false, self_created: true }
    db.players.push(p); db.player_ratings.push({ player_id: p.id, tecnica: 5, fisico: 5, marcacao: 5, finalizacao: 5 }); save()
    return { data: null, error: null }
  },
  set_match_award: ({ p_match, p_kind, p_players }) => {
    const r = me()?.role; if (r !== 'presidente' && r !== 'organizador') return err('Só presidente e organizador definem MVP e bagre')
    const db = load(); db.match_awards = (db.match_awards ?? []).filter((a: Row) => !(a.match_id === p_match && a.kind === p_kind))
    for (const player_id of p_players ?? []) db.match_awards.push({ match_id: p_match, kind: p_kind, player_id })
    save(); return { data: null, error: null }
  },
  debtors: () => {
    const db = load(); const dueDay = db.club_settings[0].due_day
    const today = new Date().toISOString().slice(0, 10)
    const late = db.dues.filter((d) => d.status !== 'pago' && iso(new Date(Number(d.month.slice(0, 4)), Number(d.month.slice(5, 7)) - 1, dueDay)) < today)
    const by: Record<string, { player_id: string; name: string; avatar: unknown; months: number; total: number }> = {}
    late.forEach((d) => {
      const p = db.players.find((x) => x.id === d.player_id); if (!p) return
      by[p.id] ??= { player_id: p.id, name: p.name, avatar: p.avatar, months: 0, total: 0 }
      by[p.id].months++; by[p.id].total += Number(d.amount)
    })
    return { data: Object.values(by).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)), error: null }
  },
  approve_member: ({ pid }) => {
    const r = me()?.role; if (r !== 'presidente' && r !== 'organizador') return err('Só presidente e organizador aprovam membros')
    const p = load().players.find((x) => x.id === pid); if (p) { p.approved = true; save() }
    return { data: null, error: null }
  },
  reject_member: ({ pid }) => {
    const r = me()?.role; if (r !== 'presidente' && r !== 'organizador') return err('Só presidente e organizador recusam membros')
    const db = load(); const p = db.players.find((x) => x.id === pid)
    if (!p || p.approved !== false) return err('Esse membro já foi aprovado')
    if (p.self_created) db.players.splice(db.players.indexOf(p), 1); else { p.user_id = null; p.approved = true }
    save(); return { data: null, error: null }
  },
  update_my_profile: (a) => {
    const p = me(); if (!p) return err('Faça login primeiro')
    Object.assign(p, { position: a.p_position, foot: a.p_foot, shirt_number: a.p_shirt_number, birthday: a.p_birthday, avatar: a.p_avatar ?? p.avatar }); save()
    return { data: null, error: null }
  },
  set_rsvp: ({ p_match, p_rsvp }) => {
    const p = me(); if (!p) return err('Faça login primeiro')
    const db = load()
    if (db.matches.find((m) => m.id === p_match)?.status !== 'aberta') return err('A lista já fechou: os times foram postados')
    const a = db.attendances.find((x) => x.match_id === p_match && x.player_id === p.id)
    if (a) { if (a.rsvp !== p_rsvp) { a.rsvp = p_rsvp; a.rsvp_at = new Date().toISOString() } }
    else db.attendances.push({ match_id: p_match, player_id: p.id, rsvp: p_rsvp, rsvp_at: new Date().toISOString(), team: null, is_reserve: false, played: false })
    save(); return { data: null, error: null }
  },
  ranking: () => ({ data: rankingRows(load()), error: null }),
  unclaimed_players_public: ({ code }) => {
    const db = load()
    if (String(code).trim().toLowerCase() !== db.club_settings[0].club_code.toLowerCase()) return { data: [], error: null }
    return { data: db.players.filter((p) => !p.user_id && !p.is_guest).map((p) => ({ id: p.id, name: p.name })).sort((a, b) => a.name.localeCompare(b.name)), error: null }
  },
  login_email: ({ p_name }) => {
    const db = load()
    const n = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
    const p = db.players.find((x) => !x.is_guest && x.user_id && n(x.name) === n(String(p_name)))
    return { data: p ? db._users.find((u) => u.id === p.user_id)?.email ?? null : null, error: null }
  },
  reset_pin: ({ p_player, p_pin }) => {
    if (me()?.role !== 'presidente') return err('Só o presidente redefine PIN')
    if (!/^[0-9]{4}$/.test(String(p_pin))) return err('O PIN precisa ter 4 números')
    const db = load(); const p = db.players.find((x) => x.id === p_player)
    const u = p?.user_id && db._users.find((x) => x.id === p.user_id)
    if (!u) return err('Esse jogador ainda não criou conta')
    u.password = `rm-${p_pin}-marditos`; save(); return { data: null, error: null }
  },
  month_cash_summary: ({ p_month, p_end }) => {
    const role = me()?.role; if (role !== 'presidente' && role !== 'tesoureiro') return err('Só presidente e tesoureiro')
    return { data: [monthSummary(load(), String(p_month), p_end ? String(p_end) : null)], error: null }
  },
  publish_cash_report: ({ p_month, p_notes, p_end }) => {
    const role = me()?.role; if (role !== 'presidente' && role !== 'tesoureiro') return err('Só presidente e tesoureiro')
    const db = load(); const month = String(p_month).slice(0, 8) + '01'
    const period_end = String(p_end ?? p_month).slice(0, 8) + '01'
    const row = { id: 'r-' + uid(), month, period_end, ...monthSummary(db, month, period_end), notes: String(p_notes ?? '').trim() || null, published_at: new Date().toISOString(), published_by: me()!.id }
    db.cash_reports = db.cash_reports.filter((r) => !(r.month === month && (r.period_end ?? r.month) === period_end)).concat(row); save()
    return { data: null, error: null }
  },
  set_club_code: ({ code }) => {
    if (me()?.role !== 'presidente') return err('Só o presidente troca o código do clube')
    if (String(code).trim().length < 4) return err('Use pelo menos 4 caracteres')
    load().club_settings[0].club_code = String(code).trim(); save(); return { data: null, error: null }
  },
  ensure_month_dues: ({ p_month }) => {
    if (!me()) return err('Faça login primeiro')
    const db = load(); const s = db.club_settings[0]
    const month = String(p_month).slice(0, 8) + '01'
    for (const p of db.players.filter((x) => !x.is_guest)) {
      if (db.dues.some((d) => d.player_id === p.id && d.month === month)) continue
      db.dues.push({ id: 'd-' + uid(), player_id: p.id, month, amount: p.status === 'afastado' ? s.fee_away : p.is_goalkeeper ? s.fee_goalkeeper : s.fee_line, status: 'pendente', receipt_path: null, informed_at: null, paid_at: null, confirmed_by: null })
    }
    save(); return { data: null, error: null }
  },
  inform_payment: ({ p_month, p_receipt_path }) => {
    const p = me(); if (!p) return err('Faça login primeiro')
    const d = load().dues.find((x) => x.player_id === p.id && x.month === String(p_month).slice(0, 8) + '01' && x.status !== 'pago')
    if (!d) return err('Mensalidade não encontrada ou já confirmada')
    Object.assign(d, { status: 'informado', informed_at: new Date().toISOString(), receipt_path: p_receipt_path ?? d.receipt_path }); save()
    return { data: null, error: null }
  },
  cash_balance: () => {
    const role = me()?.role; if (role !== 'presidente' && role !== 'tesoureiro') return { data: [], error: null }
    const db = load(); const s = db.club_settings[0]
    const dues_paid = db.dues.filter((d) => d.status === 'pago').reduce((t, d) => t + Number(d.amount), 0)
    const income = db.cash_moves.filter((c) => c.kind === 'entrada').reduce((t, c) => t + Number(c.amount), 0)
    const expenses = db.cash_moves.filter((c) => c.kind === 'saida').reduce((t, c) => t + Number(c.amount), 0)
    return { data: [{ balance: Number(s.opening_balance) + dues_paid + income - expenses, dues_paid, income, expenses }], error: null }
  },
  vote_winners: () => ({ data: me() ? voteWinners(load()) : [], error: null }),
  cast_vote: ({ p_match, p_kind, p_target }) => {
    const p = me(); if (!p) return err('Faça login primeiro')
    const db = load()
    const mt = db.matches.find((x) => x.id === p_match)
    if (mt?.status !== 'encerrada') return err('A votação abre quando a súmula for lançada')
    if (Date.now() > voteDeadline(mt).getTime()) return err('A votação dessa noite já fechou')
    const played = (id: string) => db.attendances.some((a) => a.match_id === p_match && a.player_id === id && a.played && a.team)
    if (!played(p.id)) return err('Só quem jogou nessa noite pode votar')
    if (!played(p_target)) return err('Esse jogador não jogou nessa noite')
    const v = db.votes.find((x) => x.match_id === p_match && x.voter_id === p.id && x.kind === p_kind)
    if (v) { v.target_id = p_target; v.created_at = new Date().toISOString() }
    else db.votes.push({ match_id: p_match, voter_id: p.id, kind: p_kind, target_id: p_target, created_at: new Date().toISOString() })
    save(); return { data: null, error: null }
  },
}

// ---------- Query builder ----------
type Filter = (r: Row) => boolean

class Query implements PromiseLike<any> {
  private filters: Filter[] = []
  private orderBy: { col: string; asc: boolean } | null = null
  private lim: number | null = null
  private mode: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select'
  private payload: any = null
  private cols = '*'
  private returning = false
  private sm: 'one' | 'maybe' | null = null
  private table: string
  constructor(table: string) { this.table = table }

  select(cols = '*') { if (this.mode === 'select') this.cols = cols; else this.returning = true; return this }
  insert(v: any) { this.mode = 'insert'; this.payload = v; return this }
  update(v: any) { this.mode = 'update'; this.payload = v; return this }
  upsert(v: any) { this.mode = 'upsert'; this.payload = v; return this }
  delete() { this.mode = 'delete'; return this }
  eq(c: string, v: any) { this.filters.push((r) => r[c] === v); return this }
  neq(c: string, v: any) { this.filters.push((r) => r[c] !== v); return this }
  gte(c: string, v: any) { this.filters.push((r) => r[c] >= v); return this }
  not(c: string, op: string, v: any) { if (op === 'is' && v === null) this.filters.push((r) => r[c] != null); return this }
  order(c: string, o?: { ascending?: boolean }) { this.orderBy = { col: c, asc: o?.ascending !== false }; return this }
  limit(n: number) { this.lim = n; return this }
  maybeSingle() { this.sm = 'maybe'; return this }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  then<A = any, B = never>(ok?: ((v: any) => A | PromiseLike<A>) | null, bad?: ((e: any) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    return Promise.resolve(this.run()).then(ok, bad)
  }
  singleRow() { this.sm = 'one'; return this }

  private canWrite(): string | null {
    const role = me()?.role
    const game = role === 'presidente' || role === 'organizador'
    const admin = game || role === 'tesoureiro'
    if (this.table === 'announcements') return admin ? null : 'Sem permissão'
    const money = role === 'presidente' || role === 'tesoureiro'
    if (this.table === 'club_settings') return money ? null : 'Sem permissão'
    if (this.table === 'dues' || this.table === 'cash_moves' || this.table === 'cash_reports') return money ? null : 'new row violates row-level security policy'
    if (this.table === 'votes') return 'new row violates row-level security policy'
    if (this.table === 'events') return admin ? null : 'new row violates row-level security policy'
    if (this.table === 'match_comments' || this.table === 'match_reactions' || this.table === 'event_rsvps') {
      const mine = me()?.id
      const rows = Array.isArray(this.payload) ? this.payload : this.payload ? [this.payload] : []
      if (this.mode !== 'delete' && rows.some((r: Row) => r.player_id && r.player_id !== mine)) return 'new row violates row-level security policy'
      if (this.mode === 'delete' && this.table !== 'match_comments') this.filters.push((r) => r.player_id === mine)
      if (this.mode === 'delete' && this.table === 'match_comments' && !admin) this.filters.push((r) => r.player_id === mine)
      return null
    }
    return game ? null : 'new row violates row-level security policy'
  }

  private run(): any {
    const db = load()
    const rows: Row[] = (db as any)[this.table] ?? ((db as any)[this.table] = [])
    if (this.mode !== 'select') {
      const deny = this.canWrite(); if (deny) return err(deny)
    }
    if (this.mode === 'select') {
      const isMember = !!me()
      if (!isMember) return { data: this.sm ? null : [], error: null }
      if (this.table === 'cash_moves') {
        const r = me()?.role; if (r !== 'presidente' && r !== 'tesoureiro') return { data: [], error: null }
      }
      if (this.table === 'player_ratings' || this.table === 'draw_separations') {
        const r = me()?.role; if (r !== 'presidente' && r !== 'organizador') return { data: [], error: null }
      }
      let out = rows.filter((r) => this.filters.every((f) => f(r)))
      if (this.orderBy) {
        const { col, asc } = this.orderBy
        out = out.slice().sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (asc ? 1 : -1))
      }
      if (this.lim != null) out = out.slice(0, this.lim)
      out = out.map((r) => {
        const o = { ...r }
        if (this.table === 'club_settings') delete o.club_code
        if (this.cols.includes('players(')) o.players = { ...(db.players.find((p) => p.id === r.player_id) ?? {}) }
        return o
      })
      if (this.sm) return { data: out[0] ?? null, error: null }
      return { data: out, error: null }
    }
    if (this.mode === 'insert') {
      const list = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((v: Row) => ({ ...defaults(this.table), ...v }))
      for (const v of list) {
        if (this.table === 'matches' && rows.some((m) => m.date === v.date)) return err('duplicate key value')
        rows.push(v)
        if (this.table === 'players') db.player_ratings.push({ player_id: v.id, tecnica: 5, fisico: 5, marcacao: 5, finalizacao: 5 })
      }
      save()
      return { data: this.returning ? (this.sm ? list[0] : list) : null, error: null }
    }
    if (this.mode === 'upsert') {
      const keys = PK[this.table] ?? ['id']
      for (const v of Array.isArray(this.payload) ? this.payload : [this.payload]) {
        const hit = rows.find((r) => keys.every((k) => r[k] === v[k]))
        if (hit) Object.assign(hit, v)
        else rows.push({ ...defaults(this.table), ...v })
      }
      save(); return { data: null, error: null }
    }
    if (this.mode === 'update') {
      rows.filter((r) => this.filters.every((f) => f(r))).forEach((r) => Object.assign(r, this.payload))
      save(); return { data: null, error: null }
    }
    if (this.mode === 'delete') {
      const keep = rows.filter((r) => !this.filters.every((f) => f(r)))
      ;(db as any)[this.table] = keep
      save(); return { data: null, error: null }
    }
  }
}

function defaults(table: string): Row {
  const now = new Date().toISOString()
  switch (table) {
    case 'players': return { id: 'p-' + uid(), user_id: null, phone: null, position: null, is_goalkeeper: false, foot: null, shirt_number: null, birthday: null, status: 'ativo', role: 'membro', avatar: null, initial_points: 0, is_guest: false, created_at: now }
    case 'matches': return { id: 'm-' + uid(), starts_at: '19:00:00', ends_at: '20:00:00', venue: 'Lince Arena', status: 'aberta', score_preto: null, score_branco: null, photo_url: null, created_at: now }
    case 'attendances': return { rsvp_at: now, team: null, is_reserve: false, played: false }
    case 'announcements': return { id: 'a-' + uid(), pinned: true, created_at: now }
    case 'draw_separations': return { id: 's-' + uid() }
    case 'cash_moves': return { id: 'c-' + uid(), created_at: now }
    case 'match_comments': return { id: 'mc-' + uid(), created_at: now }
    case 'match_reactions': return { created_at: now }
    case 'events': return { id: 'e-' + uid(), description: null, time: null, place: null, price: null, created_at: now }
    case 'event_rsvps': return { guests: 0, updated_at: now }
    default: return {}
  }
}

export const mockSupabase = {
  auth,
  from: (t: string) => {
    const q = new Query(t) as any
    q.single = () => q.singleRow()
    return q
  },
  rpc: async (name: string, args: any = {}) => {
    await new Promise((r) => setTimeout(r, 120))
    const fn = rpcs[name]
    return fn ? fn(args) : err('Função não existe: ' + name)
  },
}
