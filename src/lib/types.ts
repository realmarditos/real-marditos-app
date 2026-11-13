export type Role = 'membro' | 'presidente' | 'tesoureiro' | 'organizador'
export type Status = 'ativo' | 'afastado'
export type MatchStatus = 'aberta' | 'times_postados' | 'encerrada'
export type Team = 'preto' | 'branco'
export type Rsvp = 'vou' | 'nao_vou'

export type AvatarOptions = import('./pixelAvatar').PixelAvatar

export type Player = {
  id: string
  user_id: string | null
  name: string
  phone: string | null
  position: string | null
  is_goalkeeper: boolean
  foot: string | null
  shirt_number: number | null
  birthday: string | null
  status: Status
  role: Role
  avatar: AvatarOptions | null
  initial_points: number
  is_guest: boolean
  /** false = conta nova esperando a diretoria aprovar */
  approved?: boolean
  self_created?: boolean
}

export type Rating = {
  player_id: string
  tecnica: number
  fisico: number
  marcacao: number
  finalizacao: number
}

export type Match = {
  id: string
  date: string
  starts_at: string
  ends_at: string
  venue: string
  status: MatchStatus
  score_preto: number | null
  score_branco: number | null
  photo_url: string | null
}

export type Attendance = {
  match_id: string
  player_id: string
  rsvp: Rsvp
  rsvp_at: string
  team: Team | null
  is_reserve: boolean
  played: boolean
}

export type RankingRow = {
  player_id: string
  name: string
  avatar: AvatarOptions | null
  is_goalkeeper: boolean
  status: Status
  points: number
  games: number
  wins: number
  draws: number
  losses: number
  mvps: number
  bagres: number
}

export type Announcement = { id: string; body: string; pinned: boolean; created_at: string }

export type Settings = {
  season: number
  confirm_deadline: string
  max_players: number
  pts_win: number
  pts_draw: number
  pts_loss: number
  pts_presence: number
  pts_mvp: number
  fee_line: number
  fee_goalkeeper: number
  fee_away: number
  due_day: number
  reminder_day: number
  pix_key: string | null
  pix_name: string | null
  pix_city: string | null
  opening_balance: number
  /** Dia em que o caixa passou para o app (o saldo inicial vale nesta data) */
  cash_start: string
  /** Custo da quadra por jogo, para a previsão */
  court_fee: number
}

export const SETTINGS_COLS = 'season,confirm_deadline,max_players,pts_win,pts_draw,pts_loss,pts_presence,pts_mvp,fee_line,fee_goalkeeper,fee_away,due_day,reminder_day,pix_key,pix_name,pix_city,opening_balance,cash_start,court_fee'

export const isAdminRole = (r?: Role | null) => r === 'presidente' || r === 'tesoureiro' || r === 'organizador'
export const canManageGame = (r?: Role | null) => r === 'presidente' || r === 'organizador'

export const ROLE_LABEL: Record<Role, string> = {
  membro: 'Membro',
  presidente: 'Presidente',
  tesoureiro: 'Tesoureiro',
  organizador: 'Organizador',
}

export const TEAM_LABEL: Record<Team, string> = { preto: 'Time Preto', branco: 'Time Branco' }

export type VoteKind = 'mvp' | 'bagre'
export type Vote = { match_id: string; voter_id: string; kind: VoteKind; target_id: string; created_at: string }
export type VoteWinner = { match_id: string; kind: VoteKind; player_id: string; votes: number }

/** Mesma regra do banco: a votação fecha 24h depois do fim do jogo (horário de Brasília). */
export function voteDeadline(m: Pick<Match, 'date' | 'ends_at'>): Date {
  return new Date(new Date(`${m.date}T${m.ends_at.slice(0, 8)}-03:00`).getTime() + 24 * 3600 * 1000)
}
export const votingOpen = (m: Match) => m.status === 'encerrada' && Date.now() <= voteDeadline(m).getTime()

export type DueStatus = 'pendente' | 'informado' | 'pago'
export type Due = {
  id: string; player_id: string; month: string; amount: number; status: DueStatus
  receipt_path: string | null; informed_at: string | null; paid_at: string | null; confirmed_by: string | null
}
export type CashMove = { id: string; kind: 'entrada' | 'saida'; category: string; amount: number; date: string; description: string | null; created_at: string }
export type Balance = { balance: number; dues_paid: number; income: number; expenses: number }

export const EXPENSE_CATEGORIES = ['Quadra', 'Bola', 'Coletes', 'Arbitragem', 'Churrasco', 'Outros']
export const INCOME_CATEGORIES = ['Convidados', 'Patrocínio', 'Rifa', 'Outros']
export const canManageMoney = (r?: Role | null) => r === 'presidente' || r === 'tesoureiro'

export function monthISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
export const monthName = (iso: string) => MONTHS[Number(iso.slice(5, 7)) - 1]
export function shiftMonth(iso: string, delta: number) {
  const d = new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1 + delta, 1)
  return monthISO(d)
}
/** Atrasado = não pago e já passou do dia de vencimento daquele mês. */
export function isLate(due: Pick<Due, 'status' | 'month'>, dueDay: number) {
  if (due.status === 'pago') return false
  const [y, m] = due.month.split('-').map(Number)
  const limit = new Date(y, m - 1, dueDay, 23, 59, 59)
  return Date.now() > limit.getTime()
}

export type CashReport = {
  id: string; month: string; period_end?: string; opening: number; dues_in: number; income: number; expenses: number; closing: number
  by_category: { category: string; amount: number }[]; paid_count: number; total_count: number
  notes: string | null; published_at: string; published_by: string | null
}

export type MatchComment = { id: string; match_id: string; player_id: string; body: string; created_at: string }
export type MatchReaction = { match_id: string; player_id: string; emoji: string }
export const REACTIONS = ['🔥', '😂', '👏', '💀', '🐟']
export type ClubEvent = { id: string; title: string; description: string | null; date: string; time: string | null; place: string | null; price: number | null }
export type EventRsvp = { event_id: string; player_id: string; rsvp: Rsvp; guests: number }

/** Posições do futsal da patota. */
export const POSITIONS = ['Goleiro', 'Defesa', 'Meio', 'Ataque'] as const
export const POSITION_SHORT: Record<string, string> = { Goleiro: 'GOL', Defesa: 'DEF', Meio: 'MEI', Ataque: 'ATA' }

/** Nome do período de uma prestação de contas: "Novembro 2026", "1º semestre 2026", "Ano 2026" ou "Jul a Nov 2026". */
export function periodLabel(start: string, end?: string | null) {
  const e = end ?? start
  const y = start.slice(0, 4), m0 = Number(start.slice(5, 7)), m1 = Number(e.slice(5, 7))
  if (start === e) return `${monthName(start)} ${y}`
  if (y === e.slice(0, 4)) {
    if (m0 === 1 && m1 === 12) return `Ano ${y}`
    if (m0 === 1 && m1 === 6) return `1º semestre ${y}`
    if (m0 === 7 && m1 === 12) return `2º semestre ${y}`
    return `${monthName(start).slice(0, 3)} a ${monthName(e).slice(0, 3)} ${y}`
  }
  return `${monthName(start).slice(0, 3)}/${y} a ${monthName(e).slice(0, 3)}/${e.slice(0, 4)}`
}
