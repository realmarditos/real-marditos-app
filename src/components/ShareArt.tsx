import { useEffect, useRef, useState, type ReactNode } from 'react'
import { toPng } from 'html-to-image'

const isIOS = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

const toDataUrl = (blob: Blob) => new Promise<string>((ok, err) => {
  const fr = new FileReader(); fr.onload = () => ok(String(fr.result)); fr.onerror = err; fr.readAsDataURL(blob)
})

/** Troca toda imagem da arte por dados embutidos: no iPhone, imagens por endereço somem da captura. */
async function inlineImages(node: HTMLElement) {
  const imgs = [...node.querySelectorAll('img')]
  await Promise.all(imgs.map(async (img) => {
    const src = img.getAttribute('src') ?? ''
    if (src && !src.startsWith('data:')) {
      try {
        const blob = await (await fetch(src, { mode: 'cors' })).blob()
        img.src = await toDataUrl(blob)
      } catch { /* deixa como está */ }
    }
    try { await img.decode() } catch { /* imagem quebrada: segue sem ela */ }
  }))
}

/**
 * Folha com a prévia de uma arte e o botão de mandar no WhatsApp (menu de compartilhar do celular).
 * A prévia aparece reduzida para caber inteira na tela; a imagem gerada sai no tamanho real.
 * Sem suporte a compartilhar arquivo, mostra a imagem para salvar.
 */
export default function ShareArt({ title, file, text, onClose, children }: {
  title: string; file: string; text?: string; onClose: () => void; children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [img, setImg] = useState<string | null>(null)
  const [size, setSize] = useState({ w: 360, h: 640 })

  // Mede a arte para reduzir a prévia
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const ro = new ResizeObserver(() => setSize({ w: node.offsetWidth, h: node.offsetHeight }))
    ro.observe(node)
    return () => ro.disconnect()
  }, [])
  const maxH = Math.max(260, (typeof window !== 'undefined' ? window.innerHeight : 800) * 0.58)
  const scale = Math.min(1, maxH / size.h, 300 / size.w)

  async function share() {
    if (!ref.current) return
    setBusy(true)
    let data: string | null = null
    const node = ref.current
    try { await document.fonts.ready } catch { /* sem suporte */ }
    await inlineImages(node)
    try {
      // O iPhone costuma precisar de algumas passadas até as imagens entrarem
      for (let i = 0; i < (isIOS ? 3 : 1); i++) await toPng(node, { pixelRatio: 1 })
      data = await toPng(node, { pixelRatio: 3 })
    } catch {
      try { data = await toPng(node, { pixelRatio: 3, skipFonts: true }) } catch { data = null }
    }
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
            <img src={img} alt={title} style={{ width: 260, maxWidth: '100%', borderRadius: 12 }} />
            <p className="small" style={{ margin: 0, textAlign: 'center' }}>Segure a imagem para salvar ou compartilhar.</p>
            <a href={img} download={`${file}.png`} className="btn ghost block sm">Baixar imagem</a>
          </>
        ) : (
          <>
            {/* Caixa no tamanho reduzido; dentro, a arte em tamanho real com escala (a captura usa a arte sem escala) */}
            <div style={{ width: size.w * scale, height: size.h * scale, borderRadius: 12, overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,.4)', flex: '0 0 auto' }}>
              <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: size.w }}>
                <div ref={ref} style={{ width: 'max-content' }}>{children}</div>
              </div>
            </div>
            <button className="btn gold block" disabled={busy} onClick={share}>{busy ? 'Gerando imagem…' : 'Mandar no WhatsApp'}</button>
          </>
        )}
        <button className="btn ghost block sm" onClick={onClose}>Fechar</button>
      </div>
    </div>
  )
}
