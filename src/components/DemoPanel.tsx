import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { demoLoginAs, resetDemo, DEMO_CODE } from '../lib/mockSupabase'

/** Só aparece na versão de teste. Troca de usuário e reinicia os dados. */
export default function DemoPanel() {
  const [open, setOpen] = useState(false)
  const nav = useNavigate()
  const go = (fn: () => void) => { fn(); setOpen(false); nav('/') }

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Painel da demonstração"
        style={{ position: 'fixed', top: 'calc(env(safe-area-inset-top) + 2px)', left: '50%', transform: 'translateX(-50%)', zIndex: 60, height: 22, padding: '0 10px', borderRadius: 999, border: 0, background: 'var(--gold)', color: 'var(--brand-navy)', fontSize: 10, fontWeight: 700, letterSpacing: '.06em' }}>
        DEMO
      </button>
      {open && (
        <div className="sheet-bg" onClick={() => setOpen(false)}>
          <div className="sheet" role="dialog" aria-label="Demonstração" onClick={(e) => e.stopPropagation()}>
            <h2 className="h-l" style={{ fontSize: 24 }}>Versão de teste</h2>
            <p className="small muted" style={{ margin: 0 }}>
              Os dados ficam só neste navegador. Nada é enviado para a galera.
            </p>
            <div className="card raised stack" style={{ gap: 4 }}>
              <p className="small" style={{ margin: 0 }}>Código do clube: <strong>{DEMO_CODE}</strong></p>
              <p className="small" style={{ margin: 0 }}>Pedro · PIN 1234</p>
              <p className="small" style={{ margin: 0 }}>Japa · PIN 1234</p>
            </div>
            <button className="btn gold block" onClick={() => go(() => demoLoginAs('u-pedro'))}>Entrar como Pedro (presidente)</button>
            <button className="btn blue block" onClick={() => go(() => demoLoginAs('u-japa'))}>Entrar como Japa (membro)</button>
            <button className="btn ghost block sm" onClick={() => { resetDemo(); location.reload() }}>Reiniciar dados da demo</button>
            <p className="caption muted" style={{ margin: 0 }}>Para testar o primeiro acesso, saia da conta e use "Criar conta" com o código do clube.</p>
          </div>
        </div>
      )}
    </>
  )
}
