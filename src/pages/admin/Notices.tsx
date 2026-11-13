import { useCallback, useEffect, useState } from 'react'
import { supabase, errorText } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import type { Announcement } from '../../lib/types'
import { AdminHeader, useToast } from '../../components/ui'
import { EventsAdmin } from '../../components/Events'

export default function Notices() {
  const { player } = useAuth()
  const [list, setList] = useState<Announcement[]>([])
  const [body, setBody] = useState('')
  const { toast, toastNode } = useToast()

  const load = useCallback(async () => {
    const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(30)
    setList((data as Announcement[]) ?? [])
  }, [])
  useEffect(() => { load() }, [load])

  async function publish() {
    if (!body.trim()) return
    const { error } = await supabase.from('announcements').insert({ body: body.trim(), pinned: true, created_by: player?.id })
    if (error) return toast(errorText(error))
    setBody('')
    toast('Aviso publicado no início do app')
    load()
  }
  async function togglePin(a: Announcement) {
    await supabase.from('announcements').update({ pinned: !a.pinned }).eq('id', a.id)
    load()
  }
  async function remove(a: Announcement) {
    await supabase.from('announcements').delete().eq('id', a.id)
    load()
  }

  return (
    <main className="screen">
      <AdminHeader title="Avisos" />
      <h2 className="h-title">Avisos fixados</h2>
      <section className="card stack" style={{ gap: 12 }}>
        <div className="field">
          <label htmlFor="av">Novo aviso</label>
          <textarea id="av" className="input" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Ex.: Quinta o jogo começa às 19h30" />
        </div>
        <button className="btn gold block" disabled={!body.trim()} onClick={publish}>Publicar aviso</button>
        <p className="caption muted" style={{ margin: 0 }}>Avisos fixados aparecem no início do app para todo mundo. Os 3 mais recentes ficam visíveis.</p>
      </section>
      {list.map((a) => (
        <section key={a.id} className="card stack">
          <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{a.body}</p>
          <div className="between">
            <span className="caption muted">{new Date(a.created_at).toLocaleDateString('pt-BR')} · {a.pinned ? 'Fixado' : 'Arquivado'}</span>
            <span className="row">
              <button className="btn ghost sm" style={{ height: 32, padding: '0 10px', fontSize: 13 }} onClick={() => togglePin(a)}>{a.pinned ? 'Desafixar' : 'Fixar'}</button>
              <button className="btn ghost sm" style={{ height: 32, padding: '0 10px', fontSize: 13 }} onClick={() => remove(a)}>Apagar</button>
            </span>
          </div>
        </section>
      ))}
      <EventsAdmin toast={toast} />
      {toastNode}
    </main>
  )
}
