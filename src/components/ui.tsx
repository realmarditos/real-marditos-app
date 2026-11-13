import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { avatarUri } from '../lib/avatar'
import type { AvatarOptions } from '../lib/types'
import { IMG } from '../lib/assets'

type IconName = 'wallet' | 'home' | 'ranking' | 'ball' | 'user' | 'bell' | 'pin' | 'users' | 'shuffle' | 'clipboard' | 'megaphone' | 'lock' | 'back' | 'dice' | 'edit' | 'logout' | 'settings' | 'whatsapp'

const PATHS: Record<IconName, ReactNode> = {
  wallet: <><path d="M3 7a2 2 0 0 1 2-2h12v4" /><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M16 13.5h2" /></>,
  home: <path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" />,
  ranking: <><path d="M8 21V11H3v10z" /><path d="M14.5 21V4h-5v17" /><path d="M21 21V8h-6.5" /></>,
  ball: <><circle cx="12" cy="12" r="9" /><path d="m12 7 4 3-1.5 4.5h-5L8 10z" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></>,
  bell: <><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>,
  pin: <><path d="M12 17v5" /><path d="M9 10.8V5h6v5.8l3 3.2H6z" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7" /><path d="M18 14.8c2 .7 3.5 2.4 3.5 5.2" /></>,
  shuffle: <><path d="M16 3h5v5" /><path d="M4 20 21 3" /><path d="M21 16v5h-5" /><path d="m15 15 6 6" /><path d="M4 4l5 5" /></>,
  clipboard: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6" /><path d="M9 12h6" /><path d="M9 16h3" /></>,
  megaphone: <><path d="M3 11v2a1 1 0 0 0 1 1h3l8 5V5L7 10H4a1 1 0 0 0-1 1z" /><path d="M19 9a4 4 0 0 1 0 6" /></>,
  lock: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  back: <path d="m15 18-6-6 6-6" />,
  dice: <><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.2" /><circle cx="15.5" cy="15.5" r="1.2" /><circle cx="12" cy="12" r="1.2" /></>,
  edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
  whatsapp: <><path d="M3 21l1.7-5A8.5 8.5 0 1 1 8 19.3z" /><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8a4 4 0 0 1-1.8-1.8l.8-1-1-2z" /></>,
}

export function Icon({ name, size = 22, color = 'currentColor' }: { name: IconName; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  )
}

export function Avatar({ avatar, seed, size = 'md', alt = '' }: { avatar: AvatarOptions | null | undefined; seed: string; size?: 'sm' | 'md' | 'lg'; alt?: string }) {
  return <img className={`av ${size === 'md' ? '' : size}`} src={avatarUri(avatar, seed)} alt={alt} />
}

export function TabBar() {
  const tabs: { to: string; icon: IconName; label: string }[] = [
    { to: '/', icon: 'home', label: 'Início' },
    { to: '/ranking', icon: 'ranking', label: 'Ranking' },
    { to: '/partidas', icon: 'ball', label: 'Partidas' },
    { to: '/caixa', icon: 'wallet', label: 'Caixa' },
    { to: '/perfil', icon: 'user', label: 'Perfil' },
  ]
  return (
    <div className="tabbar">
      <nav aria-label="Navegação">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
            <Icon name={t.icon} />{t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export function AdminTabBar({ canGame, canMoney }: { canGame: boolean; canMoney: boolean }) {
  const tabs: { to: string; icon: IconName; label: string }[] = [
    ...(canGame ? [
      { to: '/adm/membros', icon: 'users' as IconName, label: 'Membros' },
      { to: '/adm/jogo', icon: 'shuffle' as IconName, label: 'Jogo' },
      { to: '/adm/sumula', icon: 'clipboard' as IconName, label: 'Súmula' },
    ] : []),
    ...(canMoney ? [{ to: '/adm/caixa', icon: 'wallet' as IconName, label: 'Caixa' }] : []),
    { to: '/adm/avisos', icon: 'megaphone', label: 'Avisos' },
  ]
  return (
    <div className="tabbar">
      <nav aria-label="Navegação da diretoria">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} className={({ isActive }) => (isActive ? 'active' : '')}>
            <Icon name={t.icon} />{t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export function AdminHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <header className="stack" style={{ gap: 10 }}>
      <div className="between">
        <span className="badge-adm">Diretoria</span>
        <Link to="/" className="small" style={{ textDecoration: 'none' }}>Voltar ao app</Link>
      </div>
      <div className="between" style={{ alignItems: 'flex-end' }}>
        <h1 className="h-xl">{title}</h1>
        {right}
      </div>
    </header>
  )
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 2400)
    return () => clearTimeout(t)
  }, [msg])
  const node = msg ? <div className="toast" role="status">{msg}</div> : null
  return { toast: setMsg, toastNode: node }
}

export function Loading() {
  return <div className="center-page"><img src={IMG.escudo} alt="Carregando" style={{ width: 64, opacity: 0.6 }} /></div>
}

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
export function formatDate(iso: string, withWeekday = true) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const dm = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`
  return withWeekday ? `${WEEKDAYS[dt.getDay()]}, ${dm}` : dm
}
export const hhmm = (t: string) => t.slice(0, 5).replace(':00', 'h').replace(':', 'h')
export function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export function nextThursdayISO() {
  const d = new Date()
  const add = (4 - d.getDay() + 7) % 7
  d.setDate(d.getDate() + add)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
