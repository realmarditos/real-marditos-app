import { useCallback, useEffect, useState } from 'react'
import { supabase, errorText } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { ClubEvent, EventRsvp, Player } from '../lib/types'
import { brl } from '../lib/pix'
import { formatDate, hhmm, todayISO } from './ui'

type Names = Record<string, string>

function useEvents() {
  const [events, setEvents] = useState<ClubEvent[]>([])
  const [rsvps, setRsvps] = useState<EventRsvp[]>([])
  const [names, setNames] = useState<Names>({})
  const load = useCallback(async () => {
    const [{ data: e }, { data: r }, { data: p }] = await Promise.all([
      supabase.from('events').select('*').gte('date', todayISO()).order('date'),
      supabase.from('event_rsvps').select('*'),
      supabase.from('players').select('id,name'),
    ])
    setEvents((e as ClubEvent[]) ?? [])
    setRsvps((r as EventRsvp[]) ?? [])
    setNames(Object.fromEntries(((p as Player[]) ?? []).map((x) => [x.id, x.name])))
  }, [])
  useEffect(() => {
    load()
    // As duas listas (respondidos e não respondidos) se atualizam juntas
    window.addEventListener('marditos:events', load)
    return () => window.removeEventListener('marditos:events', load)
  }, [load])
  return { events, rsvps, names, load }
}

const headcount = (rs: EventRsvp[]) => rs.filter((r) => r.rsvp === 'vou').reduce((t, r) => t + 1 + r.guests, 0)

/**
 * Próximos eventos no início, com Vou / Não vou e acompanhantes.
 * "pendentes" fica no topo; depois que a pessoa responde, o evento desce para o fim da tela.
 */
export function EventsHome({ show = 'pendentes' }: { show?: 'pendentes' | 'respondidos' }) {
  const { player } = useAuth()
  const { events, rsvps, names, load } = useEvents()
  const [error, setError] = useState('')

  async function answer(ev: ClubEvent, rsvp: 'vou' | 'nao_vou', guests = 0) {
    if (!player) return
    const { error } = await supabase.from('event_rsvps').upsert({ event_id: ev.id, player_id: player.id, rsvp, guests, updated_at: new Date().toISOString() })
    if (error) return setError(errorText(error))
    window.dispatchEvent(new Event('marditos:events'))
  }

  const answered = (ev: ClubEvent) => rsvps.some((r) => r.event_id === ev.id && r.player_id === player?.id)
  const list = events.filter((ev) => (show === 'respondidos') === answered(ev))
  if (!list.length) return null
  return (
    <>
      {list.map((ev) => {
        const rs = rsvps.filter((r) => r.event_id === ev.id)
        const mine = rs.find((r) => r.player_id === player?.id)
        const going = rs.filter((r) => r.rsvp === 'vou')
        return (
          <section key={ev.id} className="card lg stack" style={{ gap: 12 }}>
            <div className="between" style={{ alignItems: 'flex-start' }}>
              <div>
                <p className="eyebrow" style={{ color: 'var(--brand-blue-bright)' }}>Evento</p>
                <h2 className="h-title" style={{ marginTop: 4 }}>{ev.title}</h2>
                <p className="small muted" style={{ margin: '2px 0 0' }}>
                  {formatDate(ev.date)}{ev.time ? ` · ${hhmm(ev.time)}` : ''}{ev.place ? ` · ${ev.place}` : ''}{ev.price ? ` · ${brl(ev.price)} por pessoa` : ''}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p className="stat" style={{ margin: 0, fontSize: 28 }}>{headcount(rs)}</p>
                <p className="caption muted" style={{ margin: 0 }}>pessoas</p>
              </div>
            </div>
            {ev.description && <p className="small" style={{ margin: 0, whiteSpace: 'pre-line' }}>{ev.description}</p>}
            <div className="row">
              <button className="btn blue pill sm" style={{ flex: 1, height: 44 }} disabled={mine?.rsvp === 'vou'} onClick={() => answer(ev, 'vou', mine?.guests ?? 0)}>{mine?.rsvp === 'vou' ? 'Confirmado' : 'Vou'}</button>
              <button className="btn ghost pill sm" style={{ flex: 1, height: 44 }} disabled={mine?.rsvp === 'nao_vou'} onClick={() => answer(ev, 'nao_vou')}>Não vou</button>
            </div>
            {mine?.rsvp === 'vou' && (
              <div className="between small">
                <span>Vou levar acompanhantes</span>
                <span className="row" style={{ gap: 8 }}>
                  <button className="btn ghost sm" aria-label="Menos um acompanhante" style={{ width: 36, height: 36, padding: 0, borderRadius: 999 }} onClick={() => answer(ev, 'vou', Math.max(0, mine.guests - 1))}>−</button>
                  <strong style={{ minWidth: 16, textAlign: 'center' }}>{mine.guests}</strong>
                  <button className="btn ghost sm" aria-label="Mais um acompanhante" style={{ width: 36, height: 36, padding: 0, borderRadius: 999 }} onClick={() => answer(ev, 'vou', Math.min(10, mine.guests + 1))}>+</button>
                </span>
              </div>
            )}
            {going.length > 0 && (
              <p className="caption muted" style={{ margin: 0 }}>
                Vão: {going.map((r) => names[r.player_id] + (r.guests ? ` +${r.guests}` : '')).join(', ')}
              </p>
            )}
            {error && <p className="error">{error}</p>}
          </section>
        )
      })}
    </>
  )
}

/** Aniversariantes do mês (pela data que cada um põe no perfil). */
export function BirthdaysHome() {
  const [list, setList] = useState<{ name: string; day: number }[]>([])
  useEffect(() => {
    supabase.from('players').select('name,birthday,is_guest').then(({ data }) => {
      const m = new Date().getMonth() + 1
      setList(((data as Player[]) ?? [])
        .filter((p) => p.birthday && !p.is_guest && Number(p.birthday.slice(5, 7)) === m)
        .map((p) => ({ name: p.name, day: Number(p.birthday!.slice(8, 10)) }))
        .sort((a, b) => a.day - b.day))
    })
  }, [])
  if (!list.length) return null
  const today = new Date().getDate()
  const now = list.filter((b) => b.day === today)
  return (
    <section className="card row" style={{ alignItems: 'flex-start', gap: 12, border: now.length ? '1px solid var(--gold)' : undefined }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginTop: 1, flex: '0 0 auto' }}>
        <path d="M4 21h16" /><path d="M5 21v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7" /><path d="M5 16c2 1 3 1 4.5 0s3-1 4.5 0 3 1 5 0" /><path d="M12 12V8" /><path d="M12 5.5c.8-.6 1-1.5 0-2.5-1 1-.8 1.9 0 2.5z" />
      </svg>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontWeight: 600 }}>{now.length ? `Hoje é aniversário ${now.length > 1 ? 'de' : 'do'} ${now.map((b) => b.name).join(' e ')}!` : 'Aniversariantes do mês'}</p>
        <p className="small muted" style={{ margin: '2px 0 0' }}>
          {list.map((b) => `${b.name} (${String(b.day).padStart(2, '0')})`).join(' · ')}
        </p>
      </div>
    </section>
  )
}

/** Diretoria: criar e acompanhar eventos. */
export function EventsAdmin({ toast }: { toast: (m: string) => void }) {
  const { player } = useAuth()
  const { events, rsvps, names, load } = useEvents()
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [place, setPlace] = useState('')
  const [price, setPrice] = useState('')
  const [desc, setDesc] = useState('')

  async function create() {
    if (!title.trim() || !date) return toast('Preencha o nome e a data do evento.')
    const { error } = await supabase.from('events').insert({
      title: title.trim(), date, time: time || null, place: place.trim() || null,
      price: price ? Number(price.replace(',', '.')) : null, description: desc.trim() || null, created_by: player?.id,
    })
    if (error) return toast(errorText(error))
    setTitle(''); setDate(''); setTime(''); setPlace(''); setPrice(''); setDesc('')
    toast('Evento criado. Já aparece no início do app.')
    load()
  }
  async function remove(ev: ClubEvent) {
    const { error } = await supabase.from('events').delete().eq('id', ev.id)
    if (error) return toast(errorText(error))
    load()
  }

  return (
    <>
      <h2 className="h-title" style={{ marginTop: 8 }}>Eventos</h2>
      <section className="card stack" style={{ gap: 12 }}>
        <div className="field"><label htmlFor="evt">Nome do evento</label><input id="evt" className="input" placeholder="Ex.: Churrasco de encerramento" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="grid2">
          <div className="field"><label htmlFor="evd">Data</label><input id="evd" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="field"><label htmlFor="evh">Horário</label><input id="evh" className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
        </div>
        <div className="grid2">
          <div className="field"><label htmlFor="evl">Local</label><input id="evl" className="input" value={place} onChange={(e) => setPlace(e.target.value)} /></div>
          <div className="field"><label htmlFor="evp">Valor por pessoa (R$)</label><input id="evp" className="input" inputMode="decimal" placeholder="Opcional" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.,]/g, ''))} /></div>
        </div>
        <div className="field"><label htmlFor="evx">Detalhes</label><textarea id="evx" className="input" value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
        <button className="btn gold block" onClick={create}>Criar evento</button>
      </section>
      {events.map((ev) => {
        const rs = rsvps.filter((r) => r.event_id === ev.id)
        const going = rs.filter((r) => r.rsvp === 'vou')
        return (
          <section key={ev.id} className="card stack" style={{ gap: 6 }}>
            <div className="between">
              <strong>{ev.title}</strong>
              <button className="btn ghost sm" style={{ height: 32, padding: '0 10px', fontSize: 13 }} onClick={() => remove(ev)}>Apagar</button>
            </div>
            <p className="small muted" style={{ margin: 0 }}>{formatDate(ev.date)} · {headcount(rs)} pessoas ({going.length} da patota + {going.reduce((t, r) => t + r.guests, 0)} acompanhantes)</p>
            {going.length > 0 && <p className="caption" style={{ margin: 0 }}>{going.map((r) => names[r.player_id] + (r.guests ? ` +${r.guests}` : '')).join(', ')}</p>}
            {ev.price ? <p className="caption gold-text" style={{ margin: 0 }}>Total esperado: {brl(Number(ev.price) * headcount(rs))}</p> : null}
          </section>
        )
      })}
    </>
  )
}
