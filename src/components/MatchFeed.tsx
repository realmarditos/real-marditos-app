import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase, errorText } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { MatchComment, MatchReaction, Player } from '../lib/types'
import { REACTIONS, isAdminRole } from '../lib/types'
import { Avatar } from './ui'

/** Reações e comentários de uma partida. */
export default function MatchFeed({ matchId, players }: { matchId: string; players: Record<string, Pick<Player, 'id' | 'name' | 'avatar'>> }) {
  const { player } = useAuth()
  const [reactions, setReactions] = useState<MatchReaction[]>([])
  const [comments, setComments] = useState<MatchComment[]>([])
  const [text, setText] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const [{ data: r }, { data: c }] = await Promise.all([
      supabase.from('match_reactions').select('*').eq('match_id', matchId),
      supabase.from('match_comments').select('*').eq('match_id', matchId).order('created_at'),
    ])
    setReactions((r as MatchReaction[]) ?? [])
    setComments((c as MatchComment[]) ?? [])
  }, [matchId])
  useEffect(() => { load() }, [load])

  async function toggle(emoji: string) {
    if (!player) return
    const mine = reactions.some((r) => r.player_id === player.id && r.emoji === emoji)
    const { error } = mine
      ? await supabase.from('match_reactions').delete().eq('match_id', matchId).eq('player_id', player.id).eq('emoji', emoji)
      : await supabase.from('match_reactions').insert({ match_id: matchId, player_id: player.id, emoji })
    if (error) return setError(errorText(error))
    load()
  }

  async function send(e: FormEvent) {
    e.preventDefault()
    if (!text.trim() || !player) return
    const { error } = await supabase.from('match_comments').insert({ match_id: matchId, player_id: player.id, body: text.trim().slice(0, 500) })
    if (error) return setError(errorText(error))
    setText(''); setError(''); load()
  }

  async function remove(c: MatchComment) {
    await supabase.from('match_comments').delete().eq('id', c.id)
    load()
  }

  return (
    <div className="stack" style={{ gap: 10, borderTop: '1px solid var(--border)', padding: '12px 16px 16px' }}>
      <div className="row" style={{ flexWrap: 'wrap', gap: 6 }} aria-label="Reações">
        {REACTIONS.map((e) => {
          const n = reactions.filter((r) => r.emoji === e).length
          const mine = reactions.some((r) => r.emoji === e && r.player_id === player?.id)
          const who = reactions.filter((r) => r.emoji === e).map((r) => players[r.player_id]?.name).filter(Boolean).join(', ')
          return (
            <button key={e} type="button" onClick={() => toggle(e)} aria-pressed={mine} title={who || undefined}
              style={{ height: 36, padding: '0 10px', borderRadius: 999, border: mine ? '1px solid var(--gold)' : '1px solid var(--border)', background: mine ? 'var(--surface-raised)' : 'var(--bg)', color: 'var(--ink)', fontSize: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{e}</span>{n > 0 && <span className="small" style={{ fontWeight: 600 }}>{n}</span>}
            </button>
          )
        })}
      </div>

      {comments.map((c) => {
        const p = players[c.player_id]
        const canDelete = c.player_id === player?.id || isAdminRole(player?.role)
        return (
          <div key={c.id} className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
            {p && <Avatar avatar={p.avatar} seed={p.name} size="sm" />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="small" style={{ margin: 0 }}>
                <strong>{p?.name ?? '?'}</strong>{' '}
                <span className="caption muted">{new Date(c.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
              </p>
              <p className="small" style={{ margin: 0, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{c.body}</p>
            </div>
            {canDelete && <button className="btn ghost sm" aria-label="Apagar comentário" style={{ height: 28, width: 28, padding: 0, fontSize: 14 }} onClick={() => remove(c)}>×</button>}
          </div>
        )
      })}

      <form className="row" onSubmit={send}>
        <input className="input" aria-label="Comentar" placeholder="Comente a resenha…" value={text} onChange={(e) => setText(e.target.value)} style={{ height: 44 }} maxLength={500} />
        <button className="btn blue sm" style={{ height: 44 }} disabled={!text.trim()}>Enviar</button>
      </form>
      {error && <p className="error">{error}</p>}
    </div>
  )
}
