import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Player } from './types'

type AuthState = {
  loading: boolean
  session: Session | null
  player: Player | null
  refreshPlayer: () => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthState>(null as never)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [player, setPlayer] = useState<Player | null>(null)

  const loadPlayer = useCallback(async (s: Session | null) => {
    if (!s) { setPlayer(null); return }
    const { data } = await supabase.from('players').select('*').eq('user_id', s.user.id).maybeSingle()
    setPlayer((data as Player) ?? null)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      await loadPlayer(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      loadPlayer(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [loadPlayer])

  // Busca a sessão atual na hora, para funcionar logo depois de criar a conta
  const refreshPlayer = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    setSession(data.session)
    await loadPlayer(data.session)
  }, [loadPlayer])
  const signOut = useCallback(async () => { await supabase.auth.signOut(); setPlayer(null) }, [])

  return <Ctx.Provider value={{ loading, session, player, refreshPlayer, signOut }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
