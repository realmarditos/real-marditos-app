import { useState } from 'react'
import type { AvatarOptions } from '../lib/types'
import { avatarUri, randomAvatar, label, SKINS, HAIR_COLORS, HAIRS, EYES, BROWS, MOUTHS, BEARDS, GLASSES, HATS, EXTRAS, SHIRTS } from '../lib/avatar'
import { Icon } from './ui'

type Cat = 'skin' | 'hair' | 'eyes' | 'brows' | 'mouth' | 'beard' | 'glasses' | 'hat' | 'extra' | 'shirt'
const CATS: { key: Cat; label: string; options: readonly (string | number)[] }[] = [
  { key: 'hair', label: 'Cabelo', options: HAIRS },
  { key: 'skin', label: 'Pele', options: SKINS.map((_, i) => i) },
  { key: 'eyes', label: 'Olhos', options: EYES },
  { key: 'brows', label: 'Sobrancelha', options: BROWS },
  { key: 'mouth', label: 'Boca', options: MOUTHS },
  { key: 'beard', label: 'Barba', options: BEARDS },
  { key: 'glasses', label: 'Óculos', options: GLASSES },
  { key: 'hat', label: 'Chapéu', options: HATS },
  { key: 'extra', label: 'Detalhe', options: EXTRAS },
  { key: 'shirt', label: 'Camisa', options: SHIRTS },
]

/** Editor do avatar pixel art 32×32 do Real Marditos. */
export default function AvatarPicker({ value, onChange }: { value: AvatarOptions; onChange: (a: AvatarOptions) => void }) {
  const [cat, setCat] = useState<Cat>('hair')
  const current = CATS.find((c) => c.key === cat)!
  const av = value

  return (
    <>
      <section className="card lg stripes stack" style={{ background: 'var(--brand-blue)', alignItems: 'center', gap: 12, padding: '24px 16px' }}>
        <img className="px" src={avatarUri(av)} alt="Prévia do seu avatar" style={{ width: 176, height: 176, borderRadius: 20, background: 'var(--brand-blue-bright)', border: '3px solid var(--surface)' }} />
        <button type="button" className="btn sm pill" style={{ background: 'var(--surface)', color: 'var(--ink)' }} onClick={() => onChange(randomAvatar())}>
          <Icon name="dice" size={16} />Aleatório
        </button>
      </section>

      <nav aria-label="Partes do avatar" className="row" style={{ overflowX: 'auto', paddingBottom: 4 }}>
        {CATS.map((c) => (
          <button key={c.key} type="button" className={`chip ${cat === c.key ? 'on' : ''}`} style={{ flex: '0 0 auto' }} onClick={() => setCat(c.key)}>{c.label}</button>
        ))}
      </nav>

      {(cat === 'hair' || cat === 'brows' || cat === 'beard') && (
        <div className="stack" style={{ gap: 8 }}>
          <p className="eyebrow">Cor do cabelo, sobrancelha e barba</p>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            {HAIR_COLORS.map((c, i) => (
              <button key={c} type="button" aria-label={`Cor ${i + 1}`} aria-pressed={av.hairColor === i} onClick={() => onChange({ ...av, hairColor: i })}
                style={{ width: 34, height: 34, borderRadius: 999, background: c, border: av.hairColor === i ? '3px solid var(--gold)' : '2px solid var(--border)' }} />
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
        {current.options.map((opt) => {
          const preview = { ...av, [cat]: opt } as AvatarOptions
          const selected = av[cat] === opt
          const name = typeof opt === 'number' ? `Tom ${opt + 1}` : label(opt)
          return (
            <button key={String(opt)} type="button" aria-label={`${current.label}: ${name}`} aria-pressed={selected}
              onClick={() => onChange(preview)}
              style={{ padding: 4, borderRadius: 12, background: 'var(--brand-blue-bright)', border: selected ? '3px solid var(--gold)' : '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 0 }}>
              <img className="px" src={avatarUri(preview)} alt="" style={{ width: '100%', aspectRatio: '1 / 1', display: 'block' }} />
              {typeof opt === 'string' && <span className="caption" style={{ color: "var(--brand-navy)", fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{name}</span>}
            </button>
          )
        })}
      </div>
    </>
  )
}
