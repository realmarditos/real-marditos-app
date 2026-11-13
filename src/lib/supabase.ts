import { createClient } from '@supabase/supabase-js'
import { mockSupabase } from './mockSupabase'

export const IS_DEMO = import.meta.env.VITE_DEMO === '1'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!IS_DEMO && (!url || !key)) {
  // Mensagem clara caso o .env não tenha sido criado
  console.error('Faltam VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env')
}

const real = createClient(url ?? 'http://localhost', key ?? 'missing', {
  auth: { persistSession: true, autoRefreshToken: true },
})

// Na versão de teste, um banco de mentira no navegador substitui o Supabase
export const supabase = IS_DEMO ? (mockSupabase as unknown as typeof real) : real

/** Login por nome + PIN de 4 números. O Supabase exige senha de 6+ caracteres,
 *  então o PIN vira uma senha interna. Cada conta tem um e-mail interno aleatório. */
export const pinToPassword = (pin: string) => `rm-${pin}-marditos`
export const newLoginEmail = () => `${crypto.randomUUID()}@marditos.app`
export const isPin = (pin: string) => /^[0-9]{4}$/.test(pin)

/** (antigo) celular */
export function onlyDigits(v: string) {
  return v.replace(/\D/g, '')
}

export function phoneToEmail(phone: string) {
  return `${onlyDigits(phone)}@marditos.app`
}

export function formatPhone(v: string) {
  const d = onlyDigits(v).slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

/** Traduz os erros mais comuns do Supabase para português. */
export function errorText(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? String(e)
  if (msg.includes('Invalid login credentials')) return 'Nome ou PIN incorretos.'
  if (msg.includes('players_name_unique')) return 'Já existe alguém na patota com esse nome. Use um apelido diferente.'
  if (msg.includes('Password should be at least')) return 'A senha precisa ter pelo menos 6 caracteres.'
  if (msg.includes('Database error saving new user')) return 'Código do clube inválido.'
  if (msg.includes('Failed to fetch')) return 'Sem conexão. Tente de novo.'
  return msg
}
