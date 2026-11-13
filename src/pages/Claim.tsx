import { useEffect, useState } from 'react'
import { supabase, errorText } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export default function Claim() {
  const { refreshPlayer, signOut } = useAuth()
  const [list, setList] = useState<{ id: string; name: string }[]>([])
  const [picked, setPicked] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.rpc('unclaimed_players').then(({ data }) => setList((data as { id: string; name: string }[]) ?? []))
  }, [])

  async function confirm() {
    setError('')
    setBusy(true)
    const { error } = picked === 'novo'
      ? await supabase.rpc('join_as_new_player', { player_name: newName })
      : await supabase.rpc('claim_player', { pid: picked })
    setBusy(false)
    if (error) return setError(errorText(error))
    await refreshPlayer()
  }

  return (
    <div className="app">
      <main className="screen no-tabs">
        <div>
          <p className="eyebrow gold">Primeiro acesso</p>
          <h1 className="h-xl">Quem é você?</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>Escolha seu nome para levar seus pontos do ranking.</p>
        </div>
        <div className="grid2">
          {list.map((p) => (
            <button key={p.id} type="button" className={`chip ${picked === p.id ? 'on' : ''}`} style={{ height: 48, borderRadius: 12 }} onClick={() => setPicked(p.id)}>
              {p.name}
            </button>
          ))}
          <button type="button" className={`chip ${picked === 'novo' ? 'on' : ''}`} style={{ height: 48, borderRadius: 12 }} onClick={() => setPicked('novo')}>
            Não estou na lista
          </button>
        </div>
        {picked === 'novo' && (
          <div className="field">
            <label htmlFor="nm">Seu nome ou apelido</label>
            <input id="nm" className="input" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn gold block" disabled={!picked || busy || (picked === 'novo' && !newName.trim())} onClick={confirm}>
          {busy ? 'Salvando…' : 'Sou eu'}
        </button>
        <button className="btn ghost block sm" onClick={signOut}>Sair</button>
      </main>
    </div>
  )
}
