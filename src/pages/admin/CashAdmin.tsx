import { useCallback, useEffect, useState } from 'react'
import { supabase, errorText } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import type { Balance, CashMove, CashReport, Due, Player, Settings } from '../../lib/types'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, SETTINGS_COLS, isLate, monthISO, monthName, shiftMonth, periodLabel } from '../../lib/types'
import { brl } from '../../lib/pix'
import { receiptUrl } from '../../lib/photos'
import { AdminHeader, Avatar, Icon, todayISO, useToast } from '../../components/ui'
import { DueTag, ReportCard } from '../Cash'

type Tab = 'mensalidades' | 'lancamentos' | 'prestacao' | 'config'

export default function CashAdmin() {
  const [tab, setTab] = useState<Tab>('mensalidades')
  const [settings, setSettings] = useState<Settings | null>(null)
  const [balance, setBalance] = useState<Balance | null>(null)
  const { toast, toastNode } = useToast()

  const loadTop = useCallback(async () => {
    const [{ data: st }, { data: bl }] = await Promise.all([
      supabase.from('club_settings').select(SETTINGS_COLS).maybeSingle(),
      supabase.rpc('cash_balance'),
    ])
    setSettings(st as unknown as Settings)
    setBalance(((bl as Balance[]) ?? [])[0] ?? null)
  }, [])
  useEffect(() => { loadTop() }, [loadTop])

  return (
    <main className="screen">
      <AdminHeader title="Caixa" right={balance ? <p style={{ margin: '0 0 6px', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: Number(balance.balance) < 0 ? 'var(--danger)' : 'var(--gold-text)' }}>{brl(balance.balance)}</p> : undefined} />
      <div className="row" role="tablist" style={{ overflowX: 'auto', paddingBottom: 2 }}>
        {(['mensalidades', 'lancamentos', 'prestacao', 'config'] as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`chip ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>
            {t === 'mensalidades' ? 'Mensalidades' : t === 'lancamentos' ? 'Lançamentos' : t === 'prestacao' ? 'Prestação' : 'Configurar'}
          </button>
        ))}
      </div>
      <p className="caption muted" style={{ margin: 0 }}>Saldo e lançamentos ficam só com a diretoria. A galera vê a prestação de contas que você publicar.</p>
      {tab === 'mensalidades' && settings && <DuesTab settings={settings} toast={toast} onChange={loadTop} />}
      {tab === 'lancamentos' && <MovesTab toast={toast} onChange={loadTop} />}
      {tab === 'prestacao' && <ReportTab toast={toast} />}
      {tab === 'config' && settings && <ConfigTab settings={settings} toast={toast} onChange={loadTop} />}
      {toastNode}
    </main>
  )
}

function DuesTab({ settings, toast, onChange }: { settings: Settings; toast: (m: string) => void; onChange: () => void }) {
  const { player: me } = useAuth()
  const [month, setMonth] = useState(monthISO())
  const [dues, setDues] = useState<Due[]>([])
  const [players, setPlayers] = useState<Record<string, Player>>({})
  const [open, setOpen] = useState<Due | null>(null)

  const load = useCallback(async () => {
    if (month <= monthISO()) await supabase.rpc('ensure_month_dues', { p_month: month })
    const [{ data: d }, { data: p }] = await Promise.all([
      supabase.from('dues').select('*').eq('month', month),
      supabase.from('players').select('*').neq('approved', false),
    ])
    setDues((d as Due[]) ?? [])
    setPlayers(Object.fromEntries(((p as Player[]) ?? []).map((x) => [x.id, x])))
  }, [month])
  useEffect(() => { load() }, [load])

  const order = (d: Due) => (d.status === 'informado' ? 0 : d.status === 'pendente' ? 1 : 2)
  const list = [...dues].sort((a, b) => order(a) - order(b) || (players[a.player_id]?.name ?? '').localeCompare(players[b.player_id]?.name ?? ''))
  const paid = dues.filter((d) => d.status === 'pago')
  const total = dues.reduce((t, d) => t + Number(d.amount), 0)
  const got = paid.reduce((t, d) => t + Number(d.amount), 0)
  const pend = dues.filter((d) => d.status !== 'pago')

  async function setStatus(d: Due, status: Due['status']) {
    const { error } = await supabase.from('dues').update({
      status, paid_at: status === 'pago' ? new Date().toISOString() : null, confirmed_by: status === 'pago' ? me?.id : null,
      ...(status === 'pendente' ? { informed_at: null } : {}),
    }).eq('id', d.id)
    if (error) return toast(errorText(error))
    toast(status === 'pago' ? `Pagamento de ${players[d.player_id]?.name} confirmado` : 'Status atualizado')
    setOpen(null); load(); onChange()
  }

  const cobranca = `💰 *MENSALIDADE REAL MARDITOS · ${monthName(month).toUpperCase()}*\nVence dia ${settings.due_day}.\n\nFaltam:\n${pend.map((d) => `• ${players[d.player_id]?.name} · ${brl(d.amount)}`).join('\n')}\n\nPague pelo Pix no app (aba Caixa)${settings.pix_key ? ` ou na chave ${settings.pix_key}` : ''}. Valeu!`

  return (
    <>
      <section className="card stack" style={{ gap: 10 }}>
        <div className="between">
          <button className="btn ghost sm" aria-label="Mês anterior" style={{ width: 40, height: 40, padding: 0, borderRadius: 999 }} onClick={() => setMonth(shiftMonth(month, -1))}><Icon name="back" size={18} /></button>
          <div style={{ textAlign: 'center' }}>
            <h2 className="h-title">{monthName(month)}</h2>
            <p className="caption muted" style={{ margin: 0 }}>{paid.length} de {dues.length} pagos</p>
          </div>
          <button className="btn ghost sm" aria-label="Próximo mês" disabled={month >= monthISO()} style={{ width: 40, height: 40, padding: 0, borderRadius: 999, transform: 'scaleX(-1)' }} onClick={() => setMonth(shiftMonth(month, 1))}><Icon name="back" size={18} /></button>
        </div>
        <div className="bar" aria-hidden="true"><span style={{ width: `${total ? (got / total) * 100 : 0}%`, background: 'var(--success)' }} /></div>
        <p className="small" style={{ margin: 0 }}>Arrecadado <strong>{brl(got)}</strong> de {brl(total)}</p>
        {pend.length > 0 && (
          <a className="btn ghost block sm" style={{ textDecoration: 'none' }} href={`https://wa.me/?text=${encodeURIComponent(cobranca)}`} target="_blank" rel="noreferrer">
            <Icon name="whatsapp" size={18} />Cobrar {pend.length} no WhatsApp
          </a>
        )}
      </section>

      <div className="stack" style={{ gap: 6 }}>
        {list.map((d) => {
          const p = players[d.player_id]
          return (
            <button key={d.id} className="list-row" onClick={() => setOpen(d)} style={{ border: d.status === 'informado' ? '1px solid var(--gold)' : 0 }}>
              {p && <Avatar avatar={p.avatar} seed={p.name} size="sm" />}
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 500 }}>{p?.name ?? '?'}</span>
                <span className="caption muted">{brl(d.amount)}{d.receipt_path ? ' · com comprovante' : ''}</span>
              </span>
              <DueTag due={d} dueDay={settings.due_day} />
            </button>
          )
        })}
      </div>

      {open && <DueSheet due={open} player={players[open.player_id]} dueDay={settings.due_day} onClose={() => setOpen(null)} onStatus={setStatus}
        onAmount={async (v) => {
          const { error } = await supabase.from('dues').update({ amount: v }).eq('id', open.id)
          if (error) return toast(errorText(error))
          toast('Valor atualizado'); setOpen(null); load(); onChange()
        }} />}
    </>
  )
}

function DueSheet({ due, player, dueDay, onClose, onStatus, onAmount }: {
  due: Due; player?: Player; dueDay: number; onClose: () => void
  onStatus: (d: Due, s: Due['status']) => void; onAmount: (v: number) => void
}) {
  const [amount, setAmount] = useState(String(due.amount))
  const [receipt, setReceipt] = useState<string | null>(null)
  useEffect(() => { if (due.receipt_path) receiptUrl(due.receipt_path).then(setReceipt) }, [due.receipt_path])
  const isPdf = due.receipt_path?.endsWith('.pdf') || receipt?.startsWith('data:application/pdf')
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={`Mensalidade de ${player?.name}`} onClick={(e) => e.stopPropagation()}>
        <div className="between">
          <h2 className="h-l" style={{ fontSize: 24 }}>{player?.name}</h2>
          <DueTag due={due} dueDay={dueDay} />
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          {monthName(due.month)} · {due.informed_at ? `avisou que pagou em ${new Date(due.informed_at).toLocaleDateString('pt-BR')}` : 'ainda não avisou pagamento'}
          {isLate(due, dueDay) ? ' · atrasado' : ''}
        </p>
        {receipt && (isPdf
          ? <a className="btn ghost block sm" href={receipt} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>Abrir comprovante (PDF)</a>
          : <img src={receipt} alt="Comprovante" style={{ width: '100%', borderRadius: 12, maxHeight: 360, objectFit: 'contain', background: 'var(--bg)' }} />)}
        <div className="field">
          <label htmlFor="amt">Valor da mensalidade (R$)</label>
          <div className="row">
            <input id="amt" className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ''))} />
            <button className="btn ghost sm" onClick={() => onAmount(Number(amount.replace(',', '.')) || 0)}>Salvar</button>
          </div>
        </div>
        {due.status !== 'pago' ? (
          <button className="btn gold block" onClick={() => onStatus(due, 'pago')}>{due.status === 'informado' ? 'Confirmar pagamento' : 'Marcar como pago'}</button>
        ) : (
          <button className="btn ghost block sm" onClick={() => onStatus(due, 'pendente')}>Desfazer pagamento</button>
        )}
        {due.status === 'informado' && <button className="btn ghost block sm" onClick={() => onStatus(due, 'pendente')}>Não recebi, voltar para pendente</button>}
        <button className="btn ghost block sm" onClick={onClose}>Fechar</button>
      </div>
    </div>
  )
}

function MovesTab({ toast, onChange }: { toast: (m: string) => void; onChange: () => void }) {
  const { player } = useAuth()
  const [moves, setMoves] = useState<CashMove[]>([])
  const [kind, setKind] = useState<'saida' | 'entrada'>('saida')
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0])
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [desc, setDesc] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase.from('cash_moves').select('*').order('date', { ascending: false }).limit(100)
    setMoves((data as CashMove[]) ?? [])
  }, [])
  useEffect(() => { load() }, [load])

  async function add() {
    const v = Number(amount.replace(',', '.'))
    if (!v || v <= 0) return toast('Digite o valor.')
    const { error } = await supabase.from('cash_moves').insert({ kind, category, amount: v, date, description: desc.trim() || null, created_by: player?.id })
    if (error) return toast(errorText(error))
    setAmount(''); setDesc('')
    toast(kind === 'saida' ? 'Gasto lançado' : 'Entrada lançada')
    load(); onChange()
  }
  async function remove(m: CashMove) {
    const { error } = await supabase.from('cash_moves').delete().eq('id', m.id)
    if (error) return toast(errorText(error))
    load(); onChange()
  }

  const cats = kind === 'saida' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES
  return (
    <>
      <section className="card stack" style={{ gap: 12 }}>
        <div className="row">
          <button className={`chip ${kind === 'saida' ? 'on' : ''}`} onClick={() => { setKind('saida'); setCategory(EXPENSE_CATEGORIES[0]) }}>Gasto</button>
          <button className={`chip ${kind === 'entrada' ? 'on' : ''}`} onClick={() => { setKind('entrada'); setCategory(INCOME_CATEGORIES[0]) }}>Entrada extra</button>
        </div>
        <div className="grid2">
          <div className="field">
            <label htmlFor="cat">Categoria</label>
            <select id="cat" className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {cats.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="val">Valor (R$)</label>
            <input id="val" className="input" inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ''))} />
          </div>
        </div>
        <div className="grid2">
          <div className="field">
            <label htmlFor="dt">Data</label>
            <input id="dt" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="ds">Descrição</label>
            <input id="ds" className="input" placeholder="Opcional" value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
        </div>
        <button className="btn gold block" onClick={add}>{kind === 'saida' ? 'Lançar gasto' : 'Lançar entrada'}</button>
        <p className="caption muted" style={{ margin: 0 }}>Mensalidades entram sozinhas quando você confirma o pagamento.</p>
      </section>
      <div className="stack" style={{ gap: 6 }}>
        {moves.map((m) => (
          <div key={m.id} className="list-row">
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 500 }}>{m.category}{m.description ? <span className="muted"> · {m.description}</span> : null}</span>
              <span className="caption muted">{new Date(m.date + 'T12:00').toLocaleDateString('pt-BR')}</span>
            </span>
            <span style={{ fontWeight: 600, color: m.kind === 'entrada' ? 'var(--success)' : 'var(--ink)' }}>{m.kind === 'entrada' ? '+' : '−'}{brl(m.amount)}</span>
            <button className="btn ghost sm" aria-label={`Apagar ${m.category}`} style={{ height: 32, width: 32, padding: 0 }} onClick={() => remove(m)}>×</button>
          </div>
        ))}
      </div>
    </>
  )
}

function ConfigTab({ settings, toast, onChange }: { settings: Settings; toast: (m: string) => void; onChange: () => void }) {
  const [f, setF] = useState({
    fee_line: String(settings.fee_line), fee_goalkeeper: String(settings.fee_goalkeeper), fee_away: String(settings.fee_away),
    due_day: String(settings.due_day), reminder_day: String(settings.reminder_day),
    pix_key: settings.pix_key ?? '', pix_name: settings.pix_name ?? '', pix_city: settings.pix_city ?? 'GASPAR',
    opening_balance: String(settings.opening_balance),
  })
  const num = (s: string) => Number(s.replace(',', '.')) || 0
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })

  async function save() {
    const due = Math.min(28, Math.max(1, num(f.due_day)))
    const rem = Math.min(28, Math.max(1, num(f.reminder_day)))
    const { error } = await supabase.from('club_settings').update({
      fee_line: num(f.fee_line), fee_goalkeeper: num(f.fee_goalkeeper), fee_away: num(f.fee_away),
      due_day: due, reminder_day: rem, pix_key: f.pix_key.trim() || null, pix_name: f.pix_name.trim() || null,
      pix_city: f.pix_city.trim() || null, opening_balance: num(f.opening_balance),
    }).eq('id', 1)
    if (error) return toast(errorText(error))
    toast('Configurações salvas'); onChange()
  }

  return (
    <section className="card stack" style={{ gap: 14 }}>
      <h2 className="h-title">Mensalidade (R$)</h2>
      <div className="grid3">
        <div className="field"><label htmlFor="fl">Linha</label><input id="fl" className="input" inputMode="decimal" value={f.fee_line} onChange={set('fee_line')} /></div>
        <div className="field"><label htmlFor="fg">Goleiro</label><input id="fg" className="input" inputMode="decimal" value={f.fee_goalkeeper} onChange={set('fee_goalkeeper')} /></div>
        <div className="field"><label htmlFor="fa">Afastado</label><input id="fa" className="input" inputMode="decimal" value={f.fee_away} onChange={set('fee_away')} /></div>
      </div>
      <p className="caption muted" style={{ margin: 0 }}>Valores novos valem a partir do próximo mês. Quem se afasta no meio do mês paga o valor cheio.</p>
      <div className="grid2">
        <div className="field"><label htmlFor="dd">Vence no dia</label><input id="dd" className="input" inputMode="numeric" value={f.due_day} onChange={set('due_day')} /></div>
        <div className="field"><label htmlFor="rd">Lembrete no dia</label><input id="rd" className="input" inputMode="numeric" value={f.reminder_day} onChange={set('reminder_day')} /></div>
      </div>
      <h2 className="h-title" style={{ marginTop: 6 }}>Pix do caixa</h2>
      <div className="field"><label htmlFor="pk">Chave Pix</label><input id="pk" className="input" placeholder="+5547999999999, CPF, e-mail ou aleatória" value={f.pix_key} onChange={set('pix_key')} /></div>
      <p className="caption muted" style={{ margin: 0 }}>Celular: use +55 com DDD, tudo junto. CPF ou CNPJ: só números.</p>
      <div className="grid2">
        <div className="field"><label htmlFor="pn">Nome do recebedor</label><input id="pn" className="input" value={f.pix_name} onChange={set('pix_name')} /></div>
        <div className="field"><label htmlFor="pc">Cidade</label><input id="pc" className="input" value={f.pix_city} onChange={set('pix_city')} /></div>
      </div>
      <h2 className="h-title" style={{ marginTop: 6 }}>Saldo inicial</h2>
      <div className="field"><label htmlFor="ob">Dinheiro em caixa antes do app (R$)</label><input id="ob" className="input" inputMode="decimal" value={f.opening_balance} onChange={set('opening_balance')} /></div>
      <button className="btn gold block" onClick={save}>Salvar configurações</button>
    </section>
  )
}

type Summary = Omit<CashReport, 'id' | 'published_at' | 'published_by' | 'notes' | 'month' | 'period_end'>

type Kind = 'mes' | 's1' | 's2' | 'ano'
const KINDS: { key: Kind; label: string }[] = [
  { key: 's1', label: '1º semestre' }, { key: 's2', label: '2º semestre' }, { key: 'ano', label: 'Ano' }, { key: 'mes', label: 'Um mês' },
]

function ReportTab({ toast }: { toast: (m: string) => void }) {
  // Padrão: o semestre atual
  const now = monthISO()
  const [kind, setKind] = useState<Kind>(Number(now.slice(5, 7)) <= 6 ? 's1' : 's2')
  const [year, setYear] = useState(Number(now.slice(0, 4)))
  const [month, setMonth] = useState(shiftMonth(now, -1))
  const start = kind === 'mes' ? month : `${year}-${kind === 's2' ? '07' : '01'}-01`
  const end = kind === 'mes' ? month : `${year}-${kind === 's1' ? '06' : '12'}-01`
  const [sum, setSum] = useState<Summary | null>(null)
  const [published, setPublished] = useState<CashReport | null>(null)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [{ data: s, error }, { data: r }] = await Promise.all([
      supabase.rpc('month_cash_summary', { p_month: start, p_end: end }),
      supabase.from('cash_reports').select('*').eq('month', start).eq('period_end', end).maybeSingle(),
    ])
    if (error) toast(errorText(error))
    setSum(((s as Summary[]) ?? [])[0] ?? null)
    setPublished((r as CashReport) ?? null)
    setNotes((r as CashReport | null)?.notes ?? '')
  }, [start, end, toast])
  useEffect(() => { load() }, [load])

  async function publish() {
    setBusy(true)
    const { error } = await supabase.rpc('publish_cash_report', { p_month: start, p_notes: notes, p_end: end })
    setBusy(false)
    if (error) return toast(errorText(error))
    toast('Prestação de contas publicada para a galera')
    load()
  }

  const notOver = end >= now
  const step = (d: number) => (kind === 'mes' ? setMonth(shiftMonth(month, d)) : setYear(year + d))
  return (
    <>
      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
        {KINDS.map((k) => <button key={k.key} className={`chip ${kind === k.key ? 'on' : ''}`} onClick={() => setKind(k.key)}>{k.label}</button>)}
      </div>
      <section className="card stack" style={{ gap: 10 }}>
        <div className="between">
          <button className="btn ghost sm" aria-label="Período anterior" style={{ width: 40, height: 40, padding: 0, borderRadius: 999 }} onClick={() => step(-1)}><Icon name="back" size={18} /></button>
          <div style={{ textAlign: 'center' }}>
            <h2 className="h-title">{periodLabel(start, end)}</h2>
            <p className="caption muted" style={{ margin: 0 }}>{published ? `Publicada em ${new Date(published.published_at).toLocaleDateString('pt-BR')}` : 'Ainda não publicada'}</p>
          </div>
          <button className="btn ghost sm" aria-label="Próximo período" disabled={start >= now} style={{ width: 40, height: 40, padding: 0, borderRadius: 999, transform: 'scaleX(-1)' }} onClick={() => step(1)}><Icon name="back" size={18} /></button>
        </div>
        {notOver && <p className="caption" style={{ margin: 0, color: 'var(--gold-text)' }}>Esse período ainda não acabou. Dá pra publicar mesmo assim, com os números de hoje.</p>}
      </section>

      {sum && <ReportCard report={{ ...sum, month: start, period_end: end }} preview />}

      <section className="card stack" style={{ gap: 12 }}>
        <div className="field">
          <label htmlFor="nt">Recado da diretoria (opcional)</label>
          <textarea id="nt" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: compramos bola nova; quadra paga até dezembro" />
        </div>
        <button className="btn gold block" disabled={busy || !sum} onClick={publish}>{published ? 'Atualizar prestação publicada' : 'Publicar para a galera'}</button>
        <p className="caption muted" style={{ margin: 0 }}>A galera vê a prestação como está no momento da publicação. Se lançar algo depois, publique de novo para atualizar.</p>
      </section>
    </>
  )
}
