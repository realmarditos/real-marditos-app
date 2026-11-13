import { useRef, useState, type ReactNode } from 'react'
import { toPng } from 'html-to-image'

/**
 * Folha com a prévia de uma arte e o botão de mandar no WhatsApp (menu de compartilhar do celular).
 * Sem suporte a compartilhar arquivo, mostra a imagem para salvar.
 */
export default function ShareArt({ title, file, text, onClose, children }: {
  title: string; file: string; text?: string; onClose: () => void; children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [img, setImg] = useState<string | null>(null)

  async function share() {
    if (!ref.current) return
    setBusy(true)
    let data: string | null = null
    try { data = await toPng(ref.current, { pixelRatio: 3, cacheBust: true }) }
    catch { try { data = await toPng(ref.current, { pixelRatio: 3, skipFonts: true }) } catch { data = null } }
    setBusy(false)
    if (!data) return
    try {
      const blob = await (await fetch(data)).blob()
      const f = new File([blob], `${file}.png`, { type: 'image/png' })
      if (navigator.canShare?.({ files: [f] })) {
        await navigator.share({ files: [f], title, text })
        return
      }
    } catch { /* cancelou ou não suporta: mostra a imagem */ }
    setImg(data)
  }

  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()} style={{ alignItems: 'center' }}>
        <h2 className="h-l" style={{ fontSize: 22, alignSelf: 'stretch' }}>{title}</h2>
        {img ? (
          <>
            <img src={img} alt={title} style={{ width: 300, maxWidth: '100%', borderRadius: 12 }} />
            <p className="small" style={{ margin: 0, textAlign: 'center' }}>Segure a imagem para salvar ou compartilhar.</p>
            <a href={img} download={`${file}.png`} className="btn ghost block sm">Baixar imagem</a>
          </>
        ) : (
          <>
            <div style={{ borderRadius: 12, overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,.4)' }}>
              <div ref={ref}>{children}</div>
            </div>
            <button className="btn gold block" disabled={busy} onClick={share}>{busy ? 'Gerando imagem…' : 'Mandar no WhatsApp'}</button>
          </>
        )}
        <button className="btn ghost block sm" onClick={onClose}>Fechar</button>
      </div>
    </div>
  )
}
