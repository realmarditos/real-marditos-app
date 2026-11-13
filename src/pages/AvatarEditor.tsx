import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, errorText } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { AvatarOptions } from '../lib/types'
import { ensureAvatar } from '../lib/avatar'
import { Icon } from '../components/ui'
import AvatarPicker from '../components/AvatarPicker'

export default function AvatarEditor() {
  const { player, refreshPlayer } = useAuth()
  const nav = useNavigate()
  const [av, setAv] = useState<AvatarOptions>(ensureAvatar(player?.avatar, player?.name ?? ''))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (!player) return
    setBusy(true)
    const { error } = await supabase.rpc('update_my_profile', {
      p_position: player.position, p_foot: player.foot, p_shirt_number: player.shirt_number,
      p_birthday: player.birthday, p_avatar: av,
    })
    setBusy(false)
    if (error) return setError(errorText(error))
    await refreshPlayer()
    nav('/perfil')
  }

  return (
    <main className="screen no-tabs">
      <header className="between">
        <Link to="/perfil" aria-label="Voltar ao perfil" className="btn ghost" style={{ width: 44, height: 44, padding: 0, borderRadius: 999 }}>
          <Icon name="back" size={20} />
        </Link>
        <h1 className="h-l" style={{ fontSize: 24 }}>Seu avatar</h1>
        <span style={{ width: 44 }} />
      </header>
      <AvatarPicker value={av} onChange={setAv} />
      <p className="small muted" style={{ margin: 0 }}>A camisa é sempre a do Real Marditos. Seu avatar aparece no ranking, nas partidas e nas votações.</p>
      {error && <p className="error">{error}</p>}
      <button className="btn gold block" disabled={busy} onClick={save}>{busy ? 'Salvando…' : 'Salvar avatar'}</button>
    </main>
  )
}
