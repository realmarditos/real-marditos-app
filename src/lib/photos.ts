import { supabase, IS_DEMO } from './supabase'

/** Reduz a foto no próprio celular (máx. 1600px, JPEG) antes de enviar. */
async function shrink(file: File, max = 1600, quality = 0.82): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => {
      const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url
    })
    const scale = Math.min(1, max / Math.max(img.width, img.height))
    const c = document.createElement('canvas')
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale)
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    return await new Promise<Blob>((ok) => c.toBlob((b) => ok(b!), 'image/jpeg', quality))
  } finally {
    URL.revokeObjectURL(url)
  }
}

const toDataUrl = (b: Blob) => new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.readAsDataURL(b) })

/** Envia a foto do Marditos da Noite e devolve o endereço público. */
export async function uploadMatchPhoto(matchId: string, file: File): Promise<string> {
  const blob = await shrink(file, IS_DEMO ? 1000 : 1600, IS_DEMO ? 0.7 : 0.82)
  if (IS_DEMO) return toDataUrl(blob) // na demo a foto fica no próprio navegador
  const path = `marditos-da-noite/${matchId}-${Date.now()}.jpg`
  const { error } = await supabase.storage.from('fotos').upload(path, blob, { contentType: 'image/jpeg', upsert: true })
  if (error) throw error
  return supabase.storage.from('fotos').getPublicUrl(path).data.publicUrl
}

/** Comprovante de pagamento: pasta privada do próprio jogador. Devolve o caminho salvo. */
export async function uploadReceipt(playerId: string, month: string, file: File): Promise<string> {
  const blob = file.type === 'application/pdf' ? file : await shrink(file, IS_DEMO ? 900 : 1400, 0.75)
  if (IS_DEMO) return toDataUrl(blob)
  const ext = file.type === 'application/pdf' ? 'pdf' : 'jpg'
  const path = `${playerId}/${month}-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('comprovantes').upload(path, blob, { contentType: blob.type || 'image/jpeg' })
  if (error) throw error
  return path
}

/** Link temporário para a diretoria abrir o comprovante. */
export async function receiptUrl(path: string): Promise<string | null> {
  if (path.startsWith('data:')) return path
  const { data } = await supabase.storage.from('comprovantes').createSignedUrl(path, 600)
  return data?.signedUrl ?? null
}
