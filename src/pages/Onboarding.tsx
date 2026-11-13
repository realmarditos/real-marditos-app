import { useState } from 'react'
import { supabase, errorText } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { AvatarOptions } from '../lib/types'
import { POSITIONS } from '../lib/types'
import { avatarUri, ensureAvatar } from '../lib/avatar'
import AvatarPicker from '../components/AvatarPicker'

const FEET = ['Destro', 'Canhoto', 'Ambidestro']

function age(birthday: string) {
  const [y, m, d] = birthday.split('-').map(Number)
  const now = new Date()
  let a = now.getFullYear() - y
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) a--
  return a
}

/** Aparece uma vez, logo depois do "Quem é você?": monta o avatar e completa os dados. */
export default function Onboarding() {
  const { player, refreshPlayer } = useAuth()
  const [step, setStep] = useState<1 | 2>(1)
  const [av, setAv] = useState<AvatarOptions>(ensureAvatar(player?.avatar, player?.name ?? ''))
  const [position, setPosition] = useState(player?.position ?? (player?.is_goalkeeper ? 'Goleiro' : ''))
  const [shirt, setShirt] = useState(player?.shirt_number?.toString() ?? '')
  const [foot, setFoot] = useState(player?.foot ?? '')
  const [birthday, setBirthday] = useState(player?.birthday ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!player) return null

  async function finish(skip = false) {
    setBusy(true)
    const { error } = await supabase.rpc('update_my_profile', {
      p_position: skip ? player!.position : position || null,
      p_foot: skip ? player!.foot : foot || null,
      p_shirt_number: skip ? player!.shirt_number : shirt ? Number(shirt) : null,
      p_birthday: skip ? player!.birthday : birthday || null,
      // Salvar o avatar marca o perfil como montado (a tela não aparece de novo)
      p_avatar: av,
    })
    setBusy(false)
    if (error) return setError(errorText(error))
    await refreshPlayer()
  }

  const Steps = (
    <div className="row" style={{ gap: 6 }} aria-label={`Passo ${step} de 2`}>
      {[1, 2].map((n) => <span key={n} style={{ flex: 1, height: 4, borderRadius: 2, background: n <= step ? 'var(--gold)' : 'var(--border)' }} />)}
    </div>
  )

  return (
    <div className="app">
      <main className="screen no-tabs">
        {Steps}
        <header className="between" style={{ alignItems: 'flex-end' }}>
          <div>
            <p className="eyebrow gold">Bem-vindo, {player.name}!</p>
            <h1 className="h-xl" style={{ marginTop: 2 }}>{step === 1 ? 'Monte seu avatar' : 'Seus dados'}</h1>
          </div>
          <button className="btn ghost sm" style={{ height: 36, whiteSpace: "nowrap", flex: "0 0 auto" }} disabled={busy} onClick={() => finish(true)}>Fazer depois</button>
        </header>

        {step === 1 && (
          <>
            <p className="muted" style={{ margin: 0 }}>Seu avatar aparece no ranking, nas partidas, nas votações e no seu card. A camisa é sempre a do Real Marditos.</p>
            <AvatarPicker value={av} onChange={setAv} />
            <button className="btn gold block" onClick={() => setStep(2)}>Continuar</button>
          </>
        )}

        {step === 2 && (
          <>
            <section className="card row" style={{ gap: 12 }}>
              <img src={avatarUri(av)} alt="Seu avatar" style={{ width: 56, height: 56, borderRadius: 12, background: 'var(--brand-blue-bright)' }} />
              <div>
                <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, textTransform: 'uppercase' }}>{player.name}</p>
                <p className="small muted" style={{ margin: 0 }}>
                  {[position, shirt ? `Camisa ${shirt}` : null, foot, birthday ? `${age(birthday)} anos` : null].filter(Boolean).join(' · ') || 'Complete abaixo'}
                </p>
              </div>
            </section>

            <div className="stack">
              <p className="eyebrow">Posição</p>
              <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                {POSITIONS.map((p) => <button key={p} type="button" className={`chip ${position === p ? 'on' : ''}`} onClick={() => setPosition(p)}>{p}</button>)}
              </div>
            </div>

            <div className="grid2">
              <div className="field">
                <label htmlFor="ob-shirt">Número da camisa</label>
                <input id="ob-shirt" className="input" inputMode="numeric" placeholder="Ex.: 10" value={shirt}
                  onChange={(e) => setShirt(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22 }} />
              </div>
              <div className="field">
                <label htmlFor="ob-bd">Aniversário</label>
                <input id="ob-bd" className="input" type="date" value={birthday} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setBirthday(e.target.value)} />
              </div>
            </div>

            <div className="stack">
              <p className="eyebrow">Pé</p>
              <div className="row" style={{ gap: 8 }}>
                {FEET.map((f) => <button key={f} type="button" className={`chip ${foot === f ? 'on' : ''}`} onClick={() => setFoot(f)}>{f}</button>)}
              </div>
            </div>

            <p className="caption muted" style={{ margin: 0 }}>O aniversário aparece para a galera no mês do seu aniversário. Dá para mudar tudo depois no Perfil.</p>
            {error && <p className="error">{error}</p>}
            <button className="btn gold block" disabled={busy} onClick={() => finish()}>{busy ? 'Salvando…' : 'Entrar no app'}</button>
            <button className="btn ghost block sm" onClick={() => setStep(1)}>Voltar ao avatar</button>
          </>
        )}
      </main>
    </div>
  )
}
