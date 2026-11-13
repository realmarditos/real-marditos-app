/**
 * Pix "copia e cola" (BR Code estático, padrão EMV do Banco Central) com valor.
 * Funciona em qualquer app de banco.
 */
const field = (id: string, value: string) => id + String(value.length).padStart(2, '0') + value

// Bancos aceitam só ASCII em nome e cidade
const clean = (s: string, max: number) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 ]/g, '').toUpperCase().trim().slice(0, max)

export function crc16(payload: string): string {
  let crc = 0xffff
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

export function pixPayload(opts: { key: string; name: string; city: string; amount?: number; txid?: string }): string {
  const account = field('00', 'br.gov.bcb.pix') + field('01', opts.key.trim())
  const txid = (opts.txid ?? '***').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***'
  let p =
    field('00', '01') +
    field('26', account) +
    field('52', '0000') +
    field('53', '986') +
    (opts.amount ? field('54', opts.amount.toFixed(2)) : '') +
    field('58', 'BR') +
    field('59', clean(opts.name, 25) || 'REAL MARDITOS') +
    field('60', clean(opts.city, 15) || 'GASPAR') +
    field('62', field('05', txid))
  p += '6304'
  return p + crc16(p)
}

export const brl = (n: number | string) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
