import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

/** Aviso de versão nova com botão para recarregar. Confere atualizações ao voltar para o app e a cada 30 min. */
export default function UpdateBanner() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url: string, reg: ServiceWorkerRegistration | undefined) {
      if (!reg) return
      const check = () => { if (navigator.onLine) reg.update().catch(() => {}) }
      setInterval(check, 30 * 60 * 1000)
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check() })
    },
  })

  // As novidades vêm da versão nova (public/version.json), não do código que está rodando
  const [note, setNote] = useState('Tem novidades no app.')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!needRefresh) return
    fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => r.json()).then((j: { note?: string }) => j.note && setNote(j.note)).catch(() => {})
  }, [needRefresh])

  function update() {
    setBusy(true)
    updateServiceWorker(true)
    // Segurança: se a troca de versão não recarregar sozinha, recarrega em 3 s
    setTimeout(() => window.location.reload(), 3000)
  }

  if (!needRefresh) return null
  return (
    <div role="status" style={{
      position: 'fixed', left: 12, right: 12, bottom: 'calc(env(safe-area-inset-bottom) + 84px)', zIndex: 60,
      maxWidth: 456, margin: '0 auto', background: 'var(--gold)', color: 'var(--brand-navy)', borderRadius: 16,
      padding: '12px 14px', boxShadow: '0 10px 30px rgba(0,0,0,.45)', display: 'flex', gap: 12, alignItems: 'center',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, textTransform: 'uppercase' }}>App atualizado</p>
        <p style={{ margin: '2px 0 0', fontSize: 13, lineHeight: '17px' }}>{note}</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button onClick={update} disabled={busy} style={{ border: 0, borderRadius: 999, padding: '10px 16px', background: 'var(--brand-navy)', color: 'var(--ink)', fontWeight: 700, fontSize: 14 }}>{busy ? 'Atualizando…' : 'Atualizar'}</button>
        <button onClick={() => setNeedRefresh(false)} aria-label="Depois" style={{ border: 0, background: 'none', color: 'var(--brand-navy)', fontSize: 12, fontWeight: 600 }}>Depois</button>
      </div>
    </div>
  )
}
