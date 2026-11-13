import { useCallback, useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { supabase, errorText } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { CashReport, Due, Player, Settings } from '../lib/types'
import { SETTINGS_COLS, isLate, monthISO, monthName, shiftMonth, periodLabel } from '../lib/types'
import { pixPayload, brl } from '../lib/pix'
import { uploadReceipt } from '../lib/photos'
import { Avatar, Icon, useToast } from '../components/ui'

export function DueTag({ due, dueDay }: { due: Due; dueDay: number }) {
  if (due.status === 'pago') return <span className="tag ok">Pago</span>
  if (due.status === 'informado') return <span className="tag soft">Aguardando confirmação</span>
  if (isLate(due, dueDay)) return <span className="tag bad">Atrasado</span>
  return <span className="tag" style={{ background: 'var(--surface-raised)', color: 'var(--gold-text)' }}>Pendente</span>
}

export default function Cash() {
  const { player } = useAuth()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [month, setMonth] = useState(monthISO())
  const [monthDues, setMonthDues] = useState<Due[]>([])
  const [myDues, setMyDues] = useState<Due[]>([])
  const [players, setPlayers] = useState<Record<string, Pick<Player, 'id' | 'name' | 'avatar'>>>({})
  const [reports, setReports] = useState<CashReport[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [debts, setDebts] = useState<{ player_id: string; name: string; avatar: Player['avatar']; months: number; total: number }[]>([])
  const { toast, toastNode } = useToast()

  const load = useCallback(async () => {
    await supabase.rpc('ensure_month_dues', { p_month: monthISO() })
    const [{ data: st }, { data: md }, { data: my }, { data: ps }, { data: rp }, { data: db }] = await Promise.all([
      supabase.from('club_settings').select(SETTINGS_COLS).maybeSingle(),
      supabase.from('dues').select('*').eq('month', month),
      supabase.from('dues').select('*').eq('player_id', player!.id).order('month'),
      supabase.from('players').select('id,name,avatar'),
      supabase.from('cash_reports').select('*').order('published_at', { ascending: false }).limit(24),
      supabase.rpc('debtors'),
    ])
    setDebts((db as typeof debts) ?? [])
    setSettings(st as unknown as Settings)
    setMonthDues((md as Due[]) ?? [])
    setMyDues((my as Due[]) ?? [])
    setPlayers(Object.fromEntries(((ps as Player[]) ?? []).map((p) => [p.id, p])))
    setReports((rp as CashReport[]) ?? [])
    setNames(Object.fromEntries(((ps as Player[]) ?? []).map((p) => [p.id, p.name])))
  }, [month, player])
  useEffect(() => { load() }, [load])

  const dueDay = settings?.due_day ?? 10
  const unpaid = myDues.filter((d) => d.status !== 'pago')
  const current = myDues.find((d) => d.month === monthISO())

  const sortedMonth = [...monthDues].sort((a, b) => {
    const order = (d: Due) => (d.status === 'pago' ? 2 : d.status === 'informado' ? 1 : 0)
    return order(a) - order(b) || (players[a.player_id]?.name ?? '').localeCompare(players[b.player_id]?.name ?? '')
  })
  const paidCount = monthDues.filter((d) => d.status === 'pago').length

  return (
    <main className="screen">
      <header>
        <p className="eyebrow">Mensalidades e prestação de contas</p>
        <h1 className="h-xl" style={{ marginTop: 2 }}>Caixa</h1>
      </header>

      {/* Minha mensalidade */}
      {unpaid.length > 0 ? (
        unpaid.map((d) => <PayCard key={d.id} due={d} settings={settings} dueDay={dueDay} playerId={player!.id} onDone={(m) => { toast(m); load() }} />)
      ) : current ? (
        <section className="card lg row" style={{ gap: 12 }}>
          <span style={{ width: 40, height: 40, borderRadius: 999, background: 'var(--success)', color: 'var(--brand-navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>✓</span>
          <div>
            <p style={{ margin: 0, fontWeight: 600 }}>Mensalidade de {monthName(current.month)} paga</p>
            <p className="small muted" style={{ margin: 0 }}>{brl(current.amount)} · valeu, você está em dia!</p>
          </div>
        </section>
      ) : null}

      {/* Prestação de contas mensal */}
      <section className="stack">
        <h2 className="h-title">Prestação de contas</h2>
        {reports.length === 0 && <p className="small muted" style={{ margin: 0 }}>A diretoria publica o resumo do caixa de tempos em tempos. Quando sair, aparece aqui.</p>}
        {reports.map((r, i) => <ReportCard key={r.id} report={r} by={r.published_by ? names[r.published_by] : undefined} startOpen={i === 0} />)}
      </section>

      {/* Quem está devendo (mensalidades vencidas) */}
      <section className="card stack" style={{ gap: 8 }}>
        <div className="between">
          <h2 className="h-title">Devendo</h2>
          <span className="caption muted">mensalidades vencidas</span>
        </div>
        {debts.length === 0 && <p className="small muted" style={{ margin: 0 }}>Ninguém devendo. Patota em dia!</p>}
        {debts.map((d) => (
          <div key={d.player_id} className="row" style={{ gap: 10, minHeight: 40 }}>
            <Avatar avatar={d.avatar} seed={d.name} size="sm" />
            <span style={{ flex: 1, fontWeight: d.player_id === player?.id ? 600 : 400 }}>{d.name}</span>
            <span className="caption muted">{d.months} {d.months === 1 ? 'mês' : 'meses'}</span>
            <span style={{ fontWeight: 600, color: 'var(--danger)' }}>{brl(d.total)}</span>
          </div>
        ))}
      </section>

      {/* Tabela do mês: quem pagou */}
      <section className="card stack" style={{ gap: 8 }}>
        <div className="between">
          <button className="btn ghost sm" aria-label="Mês anterior" style={{ width: 40, height: 40, padding: 0, borderRadius: 999 }} onClick={() => setMonth(shiftMonth(month, -1))}><Icon name="back" size={18} /></button>
          <div style={{ textAlign: 'center' }}>
            <h2 className="h-title" style={{ textTransform: 'uppercase' }}>{monthName(month)}</h2>
            <p className="caption muted" style={{ margin: 0 }}>{paidCount} de {monthDues.length} pagos · vence dia {dueDay}</p>
          </div>
          <button className="btn ghost sm" aria-label="Próximo mês" disabled={month >= monthISO()} style={{ width: 40, height: 40, padding: 0, borderRadius: 999, transform: 'scaleX(-1)' }} onClick={() => setMonth(shiftMonth(month, 1))}><Icon name="back" size={18} /></button>
        </div>
        {monthDues.length === 0 && <p className="small muted" style={{ margin: 0 }}>Nenhuma mensalidade registrada nesse mês.</p>}
        {sortedMonth.map((d) => {
          const p = players[d.player_id]
          return (
            <div key={d.id} className="row" style={{ gap: 10, minHeight: 40 }}>
              {p && <Avatar avatar={p.avatar} seed={p.name} size="sm" />}
              <span style={{ flex: 1, fontWeight: d.player_id === player?.id ? 600 : 400 }}>{p?.name ?? '?'}</span>
              <span className="caption muted">{brl(d.amount)}</span>
              <DueTag due={d} dueDay={dueDay} />
            </div>
          )
        })}
      </section>
      {toastNode}
    </main>
  )
}

export function ReportCard({ report: r, by, startOpen = false, preview = false }: { report: Omit<CashReport, 'id' | 'published_at' | 'published_by' | 'notes'> & Partial<CashReport>; by?: string; startOpen?: boolean; preview?: boolean }) {
  const [open, setOpen] = useState(startOpen)
  const maxCat = Math.max(1, ...r.by_category.map((c) => Number(c.amount)))
  const Line = ({ label, value, sign, strong }: { label: string; value: number; sign?: string; strong?: boolean }) => (
    <div className="between small" style={{ fontWeight: strong ? 700 : 400 }}>
      <span className={strong ? '' : 'muted'}>{label}</span>
      <span style={{ color: sign === '+' ? 'var(--success)' : strong && Number(value) < 0 ? 'var(--danger)' : 'var(--ink)' }}>{sign ?? ''}{brl(value)}</span>
    </div>
  )
  return (
    <article className={`card ${open ? 'lg' : ''}`} style={{ padding: 0 }}>
      <button type="button" onClick={() => !preview && setOpen(!open)} aria-expanded={open}
        style={{ width: '100%', background: 'none', border: 0, color: 'inherit', padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left', cursor: preview ? 'default' : 'pointer' }}>
        <span>
          <span className="eyebrow" style={{ display: 'block' }}>{preview ? 'Prévia' : 'Prestação de contas'}</span>
          <span className="h-title" style={{ display: 'block', textTransform: 'uppercase' }}>{periodLabel(r.month, r.period_end)}</span>
        </span>
        <span style={{ textAlign: 'right' }}>
          <span className="caption muted" style={{ display: 'block' }}>Saldo no fim</span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24, color: Number(r.closing) < 0 ? 'var(--danger)' : 'var(--gold-text)' }}>{brl(r.closing)}</span>
        </span>
      </button>
      {(open || preview) && (
        <div className="stack" style={{ gap: 8, padding: '0 16px 16px' }}>
          <Line label={`Saldo no começo ${((r.period_end ?? r.month) === r.month) ? 'do mês' : 'do período'}`} value={r.opening} />
          <Line label="Mensalidades recebidas" value={r.dues_in} sign="+" />
          {Number(r.income) > 0 && <Line label="Outras entradas" value={r.income} sign="+" />}
          <Line label="Gastos" value={r.expenses} sign="−" />
          <div style={{ height: 1, background: 'var(--border)' }} />
          <Line label={`Saldo no fim ${(r.period_end ?? r.month) === r.month ? 'do mês' : 'do período'}`} value={r.closing} strong />
          {r.by_category.length > 0 && (
            <div className="stack" style={{ gap: 8, marginTop: 6 }}>
              <p className="eyebrow">Para onde foi o dinheiro</p>
              {r.by_category.map((c) => (
                <div key={c.category} style={{ display: 'grid', gridTemplateColumns: '88px 1fr auto', gap: 10, alignItems: 'center' }}>
                  <span className="small">{c.category}</span>
                  <span className="bar"><span style={{ width: `${(Number(c.amount) / maxCat) * 100}%`, background: 'var(--gold)' }} /></span>
                  <span className="small" style={{ fontWeight: 600 }}>{brl(c.amount)}</span>
                </div>
              ))}
            </div>
          )}
          <p className="small" style={{ margin: '6px 0 0' }}>Mensalidades {(r.period_end ?? r.month) === r.month ? 'do mês' : 'do período'}: <strong>{r.paid_count} de {r.total_count}</strong> pagas</p>
          {r.notes && <p className="small" style={{ margin: 0, whiteSpace: 'pre-line', background: 'var(--surface-raised)', borderRadius: 8, padding: '10px 12px' }}>{r.notes}</p>}
          {r.published_at && <p className="caption muted" style={{ margin: 0 }}>Publicada em {new Date(r.published_at).toLocaleDateString('pt-BR')}{by ? ` por ${by}` : ''}</p>}
        </div>
      )}
    </article>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="small" style={{ margin: 0, fontWeight: 600 }}>{value}</p>
      <p className="caption muted" style={{ margin: 0 }}>{label}</p>
    </div>
  )
}

function PayCard({ due, settings, dueDay, playerId, onDone }: { due: Due; settings: Settings | null; dueDay: number; playerId: string; onDone: (msg: string) => void }) {
  const [qr, setQr] = useState<string | null>(null)
  const [informing, setInforming] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const payload = settings?.pix_key
    ? pixPayload({ key: settings.pix_key, name: settings.pix_name ?? 'REAL MARDITOS', city: settings.pix_city ?? 'GASPAR', amount: Number(due.amount), txid: `MARDITOS${due.month.slice(0, 7).replace('-', '')}` })
    : null

  useEffect(() => {
    if (payload && due.status === 'pendente') QRCode.toDataURL(payload, { margin: 1, width: 360, color: { dark: '#141832', light: '#F5F7FA' } }).then(setQr)
  }, [payload, due.status])

  async function copy() {
    if (!payload) return
    try { await navigator.clipboard.writeText(payload); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { setCopied(false) }
  }

  async function inform() {
    setBusy(true)
    try {
      const path = file ? await uploadReceipt(playerId, due.month, file) : null
      const { error } = await supabase.rpc('inform_payment', { p_month: due.month, p_receipt_path: path })
      if (error) throw error
      onDone('Pagamento informado! O tesoureiro vai confirmar.')
    } catch (e) {
      onDone(errorText(e))
    }
    setBusy(false)
  }

  const late = isLate(due, dueDay)
  return (
    <section className="card lg stack" style={{ gap: 14, border: `1px solid ${late ? 'var(--danger)' : 'var(--gold)'}` }}>
      <div className="between" style={{ alignItems: 'flex-start' }}>
        <div>
          <p className="eyebrow" style={{ color: late ? 'var(--danger)' : 'var(--gold)' }}>Sua mensalidade · {monthName(due.month)}</p>
          <p style={{ margin: '4px 0 0', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 36, lineHeight: '40px' }}>{brl(due.amount)}</p>
          <p className="small muted" style={{ margin: 0 }}>Vence dia {dueDay}</p>
        </div>
        <DueTag due={due} dueDay={dueDay} />
      </div>

      {due.status === 'informado' && <p className="small" style={{ margin: 0 }}>Você avisou que pagou. Assim que o tesoureiro confirmar, fica verde aqui.</p>}

      {due.status === 'pendente' && (
        payload ? (
          <>
            <div className="row" style={{ gap: 14, alignItems: 'center' }}>
              {qr && <img src={qr} alt="QR code do Pix" style={{ width: 132, height: 132, borderRadius: 12, flex: '0 0 auto' }} />}
              <div className="stack" style={{ gap: 6, minWidth: 0 }}>
                <p className="small" style={{ margin: 0 }}>Escaneie o QR no app do banco ou copie o código. O valor já vem preenchido.</p>
                <p className="caption muted" style={{ margin: 0, wordBreak: 'break-all' }}>Chave: {settings?.pix_key}{settings?.pix_name ? ` · ${settings.pix_name}` : ''}</p>
              </div>
            </div>
            <button className="btn blue block sm" onClick={copy}>{copied ? 'Código copiado!' : 'Copiar Pix copia e cola'}</button>
          </>
        ) : (
          <p className="small muted" style={{ margin: 0 }}>A diretoria ainda não cadastrou a chave Pix. Combine o pagamento com o tesoureiro.</p>
        )
      )}

      {due.status === 'pendente' && (informing ? (
        <div className="stack" style={{ gap: 10 }}>
          <label className="btn ghost block sm" style={{ cursor: 'pointer' }}>
            {file ? `Comprovante: ${file.name.slice(0, 24)}` : 'Anexar comprovante (opcional)'}
            <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <div className="row">
            <button className="btn ghost sm" style={{ flex: 1 }} onClick={() => setInforming(false)}>Cancelar</button>
            <button className="btn gold sm" style={{ flex: 1 }} disabled={busy} onClick={inform}>{busy ? 'Enviando…' : 'Confirmar'}</button>
          </div>
        </div>
      ) : (
        <button className="btn gold block" onClick={() => setInforming(true)}>Já paguei</button>
      ))}
    </section>
  )
}
