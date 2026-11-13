import { useRef } from 'react'

/** Campo de PIN de 4 números, com bolinhas grandes e teclado numérico. */
export default function PinInput({ id, value, onChange, label, autoFocus }: { id: string; value: string; onChange: (v: string) => void; label: string; autoFocus?: boolean }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div style={{ position: 'relative' }} onClick={() => ref.current?.focus()}>
        <input ref={ref} id={id} type="password" inputMode="numeric" autoComplete="one-time-code" maxLength={4} autoFocus={autoFocus}
          value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
          style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', border: 0, fontSize: 16 }} />
        <div className="row" style={{ gap: 10 }} aria-hidden="true">
          {[0, 1, 2, 3].map((i) => {
            const filled = i < value.length
            const active = i === Math.min(value.length, 3)
            return (
              <span key={i} style={{ flex: 1, height: 60, borderRadius: 12, background: 'var(--bg)', border: `${active ? 2 : 1}px solid ${active ? 'var(--brand-blue-bright)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {filled && <span style={{ width: 14, height: 14, borderRadius: 999, background: 'var(--ink)' }} />}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}
