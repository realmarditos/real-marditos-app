import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase, errorText, isPin, pinToPassword } from '../lib/supabase'
import PinInput from '../components/PinInput'
import { IMG } from '../lib/assets'

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app">
      <div className="stripes" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 'calc(env(safe-area-inset-top) + 32px) 16px 24px' }}>
        <img src={IMG.logo} alt="Escudo do Real Marditos FC" style={{ width: 180, height: 'auto' }} />
        <div style={{ textAlign: 'center' }}>
          <h1 className="h-xl">Real Marditos FC</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>Quinta é dia de patota.</p>
        </div>
      </div>
      <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '24px 16px calc(env(safe-area-inset-bottom) + 32px)' }}>
        {children}
      </div>
    </div>
  )
}

export default function Login() {
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e?: FormEvent) {
    e?.preventDefault()
    setError('')
    if (!name.trim()) return setError('Digite seu nome.')
    if (!isPin(pin)) return setError('O PIN tem 4 números.')
    setBusy(true)
    const { data: email, error: e1 } = await supabase.rpc('login_email', { p_name: name })
    if (e1 || !email) { setBusy(false); return setError(e1 ? errorText(e1) : 'Não achamos esse nome. Primeiro acesso? Crie sua conta abaixo.') }
    const { error } = await supabase.auth.signInWithPassword({ email: String(email), password: pinToPassword(pin) })
    setBusy(false)
    if (error) { setPin(''); setError(errorText(error)) }
  }

  return (
    <AuthShell>
      <form className="stack" style={{ gap: 16 }} onSubmit={submit}>
        <div className="field">
          <label htmlFor="name">Seu nome na patota</label>
          <input id="name" className="input" autoComplete="username" autoCapitalize="words" placeholder="Ex.: Japa" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <PinInput id="pin" label="PIN" value={pin} onChange={(v) => { setPin(v); setError('') }} />
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn gold block" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
        <p className="small muted" style={{ margin: 0, textAlign: 'center' }}>
          Primeiro acesso? <Link to="/cadastro">Criar conta com o código do clube</Link>
        </p>
        <p className="caption muted" style={{ margin: 0, textAlign: 'center' }}>Esqueceu o PIN? Fale com o presidente.</p>
      </form>
    </AuthShell>
  )
}
