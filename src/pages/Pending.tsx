import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { avatarUri } from '../lib/avatar'

/** Conta criada, esperando a diretoria aprovar a entrada. */
export default function Pending() {
  const { player, refreshPlayer, signOut } = useAuth()
  const nav = useNavigate()
  const [busy, setBusy] = useState(false)
  const [checked, setChecked] = useState(false)

  async function check() {
    setBusy(true)
    await refreshPlayer()
    setBusy(false)
    setChecked(true)
  }

  return (
    <div className="app">
      <main className="screen no-tabs" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        {player && (
          <img src={avatarUri(player.avatar, player.name)} alt="" style={{ width: 120, height: 120, borderRadius: 20, background: 'var(--brand-blue-bright)' }} />
        )}
        <div className="stack" style={{ gap: 6, alignItems: 'center' }}>
          <p className="eyebrow gold" style={{ margin: 0 }}>Quase lá, {player?.name}</p>
          <h1 className="h-xl" style={{ margin: 0 }}>Esperando aprovação</h1>
          <p className="muted" style={{ margin: 0, maxWidth: 300 }}>
            A diretoria precisa liberar sua entrada. Avise no grupo que você criou a conta.
          </p>
        </div>
        <div className="stack" style={{ width: '100%', maxWidth: 320 }}>
          <button className="btn gold block" disabled={busy} onClick={check}>{busy ? 'Verificando…' : 'Já fui aprovado?'}</button>
          {checked && !busy && <p className="caption muted" style={{ margin: 0 }}>Ainda não. Tente de novo daqui a pouco.</p>}
          <button className="btn ghost block sm" onClick={async () => { await signOut(); nav('/', { replace: true }) }}>Sair</button>
        </div>
      </main>
    </div>
  )
}
