import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { canManageGame, canManageMoney, isAdminRole } from './lib/types'
import { AdminTabBar, Loading, TabBar } from './components/ui'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Claim from './pages/Claim'
import Pending from './pages/Pending'
import Onboarding from './pages/Onboarding'
import Home from './pages/Home'
import Ranking from './pages/Ranking'
import Matches from './pages/Matches'
import Profile from './pages/Profile'
import AvatarEditor from './pages/AvatarEditor'
import Vote from './pages/Vote'
import PlayerCard from './pages/PlayerCard'
import Cash from './pages/Cash'
import Wrapped from './pages/Wrapped'
import CashAdmin from './pages/admin/CashAdmin'
import Members from './pages/admin/Members'
import Game from './pages/admin/Game'
import Sumula from './pages/admin/Sumula'
import Notices from './pages/admin/Notices'
import DemoPanel from './components/DemoPanel'
import { IS_DEMO } from './lib/supabase'

function MemberLayout() {
  return <div className="app"><Outlet /><TabBar /></div>
}

function AdminLayout() {
  const { player } = useAuth()
  if (!isAdminRole(player?.role)) return <Navigate to="/" replace />
  return <div className="app"><Outlet /><AdminTabBar canGame={canManageGame(player?.role)} canMoney={canManageMoney(player?.role)} /></div>
}

function GameOnly({ children }: { children: React.ReactNode }) {
  const { player } = useAuth()
  return canManageGame(player?.role) ? <>{children}</> : <Navigate to="/adm/avisos" replace />
}

function MoneyOnly({ children }: { children: React.ReactNode }) {
  const { player } = useAuth()
  return isAdminRole(player?.role) ? <>{children}</> : <Navigate to="/adm/avisos" replace />
}

export default function App() {
  return <>{IS_DEMO && <DemoPanel />}<Screens /></>
}

function Screens() {
  const { loading, session, player } = useAuth()
  if (loading) return <Loading />

  if (!session) {
    return (
      <Routes>
        <Route path="/cadastro" element={<Signup />} />
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }

  if (!player) return <Claim />
  // Perfil ainda não montado (sem avatar): passa pela tela de boas-vindas uma vez
  if (!player.avatar) return <Onboarding />
  // Conta nova: espera a diretoria aprovar
  if (player.approved === false) return <Pending />

  const adminHome = canManageGame(player.role) ? '/adm/membros' : canManageMoney(player.role) ? '/adm/caixa' : '/adm/avisos'

  return (
    <Routes>
      <Route element={<MemberLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/ranking" element={<Ranking />} />
        <Route path="/partidas" element={<Matches />} />
        <Route path="/perfil" element={<Profile />} />
        <Route path="/caixa" element={<Cash />} />
      </Route>
      <Route path="/perfil/avatar" element={<div className="app"><AvatarEditor /></div>} />
      <Route path="/votar/:id" element={<div className="app"><Vote /></div>} />
      <Route path="/card" element={<div className="app"><PlayerCard /></div>} />
      <Route path="/jogador/:id" element={<div className="app"><PlayerCard /></div>} />
      <Route path="/retrospectiva" element={<Wrapped />} />
      <Route path="/adm" element={<AdminLayout />}>
        <Route index element={<Navigate to={adminHome} replace />} />
        <Route path="membros" element={<GameOnly><Members /></GameOnly>} />
        <Route path="jogo" element={<GameOnly><Game /></GameOnly>} />
        <Route path="sumula" element={<GameOnly><Sumula /></GameOnly>} />
        <Route path="caixa" element={<MoneyOnly><CashAdmin /></MoneyOnly>} />
        <Route path="avisos" element={<Notices />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
