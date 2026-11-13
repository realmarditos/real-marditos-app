import { useEffect, useRef, useState, type ReactNode } from 'react'
import { toCanvas } from 'html-to-image'

const isIOS = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

const toDataUrl = (blob: Blob) => new Promise<string>((ok, err) => {
  const fr = new FileReader(); fr.onload = () => ok(String(fr.result)); fr.onerror = err; fr.readAsDataURL(blob)
})

const loadImage = (src: string) => new Promise<HTMLImageElement>((ok, err) => {
  const im = new Image(); im.onload = () => ok(im); im.onerror = err; im.src = src
})

/** Posição de um elemento dentro da arte, sem contar a escala da prévia. */
function offsetIn(el: HTMLElement, root: HTMLElement) {
  let x = 0, y = 0, cur: HTMLElement | null = el
  while (cur && cur !== root) {
    x += cur.offsetLeft; y += cur.offsetTop
    cur = cur.offsetParent as HTMLElement | null
    if (cur && cur !== root) { x += cur.clientLeft; y += cur.clientTop }
  }
  return { x, y }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + rr, y); ctx.arcTo(x + w, y, x + w, y + h, rr); ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr); ctx.arcTo(x, y, x + w, y, rr); ctx.closePath()
}

/**
 * Gera a imagem da arte. No iPhone, fotos e PNGs somem quando o HTML vira imagem;
 * então a arte é capturada sem eles e cada um é desenhado por cima, no lugar certo.
 */
async function renderArt(node: HTMLElement, pixelRatio = 3): Promise<string> {
  const raster = [...node.querySelectorAll('img')].filter((img) => !(img.getAttribute('src') ?? '').startsWith('data:image/svg'))
  // Carrega cada imagem como dados locais (inclusive a foto, que vem de outro endereço)
  const sources = await Promise.all(raster.map(async (img) => {
    const src = img.currentSrc || img.src
    try {
      const data = src.startsWith('data:') ? src : await toDataUrl(await (await fetch(src, { mode: 'cors' })).blob())
      return await loadImage(data)
    } catch { return null }
  }))
  const prevPos = node.style.position
  node.style.position = 'relative'
  const boxes = raster.map((img) => {
    const { x, y } = offsetIn(img, node)
    const cs = getComputedStyle(img)
    let radius = parseFloat(cs.borderTopLeftRadius) || 0
    const parent = img.parentElement
    if (parent && getComputedStyle(parent).overflow === 'hidden') {
      const ps = getComputedStyle(parent)
      radius = Math.max(radius, (parseFloat(ps.borderTopLeftRadius) || 0) - (parseFloat(ps.borderTopWidth) || 0))
    }
    return { x, y, w: img.offsetWidth, h: img.offsetHeight, fit: cs.objectFit, radius }
  })
  raster.forEach((img) => { img.style.visibility = 'hidden' })
  try {
    const canvas = await toCanvas(node, { pixelRatio })
    const ctx = canvas.getContext('2d')!
    boxes.forEach((b, i) => {
      const im = sources[i]
      if (!im || !b.w || !b.h) return
      const iw = im.naturalWidth, ih = im.naturalHeight
      let dx = b.x, dy = b.y, dw = b.w, dh = b.h, sx = 0, sy = 0, sw = iw, sh = ih
      if (b.fit === 'cover') {
        const s = Math.max(b.w / iw, b.h / ih); sw = b.w / s; sh = b.h / s; sx = (iw - sw) / 2; sy = (ih - sh) / 2
      } else if (b.fit === 'contain') {
        const s = Math.min(b.w / iw, b.h / ih); dw = iw * s; dh = ih * s; dx = b.x + (b.w - dw) / 2; dy = b.y + (b.h - dh) / 2
      }
      ctx.save()
      ctx.scale(pixelRatio, pixelRatio)
      if (b.radius) { roundRect(ctx, b.x, b.y, b.w, b.h, b.radius); ctx.clip() }
      ctx.drawImage(im, sx, sy, sw, sh, dx, dy, dw, dh)
      ctx.restore()
    })
    return canvas.toDataURL('image/png')
  } finally {
    raster.forEach((img) => { img.style.visibility = '' })
    node.style.position = prevPos
  }
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
    try {
      // O iPhone às vezes precisa de uma passada antes de acertar as fontes
      if (isIOS) await renderArt(node, 1)
      data = await renderArt(node, 3)
    } catch { data = null }
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
