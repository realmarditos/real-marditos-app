import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, errorText, isPin, newLoginEmail, pinToPassword } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { AuthShell } from './Login'
import PinInput from '../components/PinInput'

type Step = 'codigo' | 'nome' | 'pin'

export default function Signup() {
  const { refreshPlayer } = useAuth()
  const [step, setStep] = useState<Step>('codigo')
  const [code, setCode] = useState('')
  const [names, setNames] = useState<{ id: string; name: string }[]>([])
  const [picked, setPicked] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function checkCode() {
    setError('')
    if (!code.trim()) return setError('Digite o código do clube.')
    setBusy(true)
    const { data: ok } = await supabase.rpc('verify_club_code', { code })
    if (!ok) { setBusy(false); return setError('Código do clube inválido.') }
    const { data } = await supabase.rpc('unclaimed_players_public', { code })
    setBusy(false)
    setNames((data as { id: string; name: string }[]) ?? [])
    setStep('nome')
  }

  async function create() {
    setError('')
    if (!isPin(pin)) return setError('O PIN precisa ter 4 números.')
    if (pin !== pin2) { setPin2(''); return setError('Os PINs não são iguais.') }
    setBusy(true)
    const { error: e1 } = await supabase.auth.signUp({
      email: newLoginEmail(), password: pinToPassword(pin),
      options: { data: { club_code: code.trim() } },
    })
    if (e1) { setBusy(false); return setError(errorText(e1)) }
    // Conta criada: liga ao jogador escolhido (se falhar, o app mostra a lista de novo)
    if (picked === 'novo') await supabase.rpc('join_as_new_player', { player_name: newName })
    else await supabase.rpc('claim_player', { pid: picked })
    setBusy(false)
    await refreshPlayer()
  }

  const chosenName = picked === 'novo' ? newName.trim() : names.find((n) => n.id === picked)?.name

  return (
    <AuthShell>
      <div className="stack" style={{ gap: 16 }}>
        <div className="row" style={{ gap: 6 }} aria-label="Etapas do cadastro">
          {(['codigo', 'nome', 'pin'] as Step[]).map((s, i) => (
            <span key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= ['codigo', 'nome', 'pin'].indexOf(step) ? 'var(--gold)' : 'var(--border)' }} />
          ))}
        </div>

        {step === 'codigo' && (
          <form className="stack" style={{ gap: 16 }} onSubmit={(e) => { e.preventDefault(); checkCode() }}>
            <div className="field">
              <label htmlFor="code">Código do clube</label>
              <input id="code" className="input" autoCapitalize="characters" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Peça para a diretoria" />
            </div>
            {error && <p className="error" role="alert">{error}</p>}
            <button className="btn gold block" disabled={busy}>{busy ? 'Conferindo…' : 'Continuar'}</button>
          </form>
        )}

        {step === 'nome' && (
          <div className="stack" style={{ gap: 14 }}>
            <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, textTransform: 'uppercase' }}>Quem é você?</p>
            <p className="small muted" style={{ margin: 0 }}>Escolha seu nome para levar seus pontos do ranking. É com ele que você vai entrar.</p>
            <div className="grid2" style={{ maxHeight: 280, overflowY: 'auto' }}>
              {names.map((p) => (
                <button key={p.id} type="button" className={`chip ${picked === p.id ? 'on' : ''}`} style={{ height: 44, borderRadius: 12 }} onClick={() => setPicked(p.id)}>{p.name}</button>
              ))}
              <button type="button" className={`chip ${picked === 'novo' ? 'on' : ''}`} style={{ height: 44, borderRadius: 12 }} onClick={() => setPicked('novo')}>Não estou na lista</button>
            </div>
            {picked === 'novo' && (
              <div className="field">
                <label htmlFor="nm">Seu nome ou apelido</label>
                <input id="nm" className="input" autoCapitalize="words" value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>
            )}
            <button className="btn gold block" disabled={!picked || (picked === 'novo' && !newName.trim())} onClick={() => { setError(''); setStep('pin') }}>Sou eu</button>
          </div>
        )}

        {step === 'pin' && (
          <form className="stack" style={{ gap: 16 }} onSubmit={(e) => { e.preventDefault(); create() }}>
            <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, textTransform: 'uppercase' }}>Crie seu PIN, {chosenName}</p>
            <p className="small muted" style={{ margin: '-8px 0 0' }}>Você vai entrar com <strong style={{ color: 'var(--ink)' }}>{chosenName}</strong> e esses 4 números.</p>
            <PinInput id="pin" label="PIN de 4 números" value={pin} onChange={setPin} autoFocus />
            <PinInput id="pin2" label="Repita o PIN" value={pin2} onChange={setPin2} />
            {error && <p className="error" role="alert">{error}</p>}
            <button className="btn gold block" disabled={busy}>{busy ? 'Criando…' : 'Criar conta'}</button>
            <button type="button" className="btn ghost block sm" onClick={() => setStep('nome')}>Voltar</button>
          </form>
        )}

        <p className="small muted" style={{ margin: 0, textAlign: 'center' }}>
          Já tem conta? <Link to="/">Entrar</Link>
        </p>
      </div>
    </AuthShell>
  )
}
