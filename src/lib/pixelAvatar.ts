/**
 * Avatar pixel art 32×32 do Real Marditos, desenhado por código.
 * Camadas: cabelo de trás, camisa, pescoço, orelhas, cabeça, rosto, barba,
 * boca, cabelo da frente, detalhes, óculos e chapéu (sem contorno).
 */

export const SKINS = ['#FBE0C8', '#F3CBA5', '#E4AE84', '#CF9466', '#B07247', '#8D5636', '#6B3F27', '#4A2B1B']
export const HAIR_COLORS = ['#1B1B1F', '#3D2618', '#6B4426', '#A3542C', '#D9B466', '#ECE6D4', '#9CA0A8', '#3E6FC2']

export const HAIRS = ['careca', 'raspado', 'curto', 'topete', 'lateral', 'espetado', 'tigela', 'undercut', 'moicano', 'cacheado', 'black', 'coque', 'mullet', 'dreads', 'longo'] as const
export const EYES = ['normal', 'feliz', 'piscando', 'de lado', 'bravo', 'sono', 'surpreso', 'chorando de rir'] as const
export const BROWS = ['normal', 'grossa', 'brava', 'erguida', 'preocupada', 'cortada'] as const
export const MOUTHS = ['sorriso', 'risada', 'neutro', 'canto', 'aberta', 'lingua', 'dentuço', 'assobio', 'triste'] as const
export const BEARDS = ['nenhuma', 'por fazer', 'cheia', 'longa', 'cavanhaque', 'bigode', 'bigodão', 'queixo', 'costeleta'] as const
export const GLASSES = ['nenhum', 'redondo', 'quadrado', 'escuro', 'esportivo'] as const
export const HATS = ['nenhum', 'boné', 'boné pra trás', 'touca', 'faixa', 'coroa'] as const
export const EXTRAS = ['nenhum', 'pintura do clube', 'sardas', 'bochecha', 'curativo', 'brinco'] as const
export const SHIRTS = ['titular', 'branca', 'preta', 'goleiro'] as const

export const LABELS: Record<string, string> = {
  black: 'Black power', lingua: 'Língua', 'chorando de rir': 'Rindo muito', 'pintura do clube': 'Pintura',
  titular: 'Azul', branca: 'Branca', preta: 'Preta', goleiro: 'Goleiro',
}
export const label = (v: string) => LABELS[v] ?? v.charAt(0).toUpperCase() + v.slice(1)

export type PixelAvatar = {
  v: 4
  skin: number
  hair: (typeof HAIRS)[number]
  hairColor: number
  eyes: (typeof EYES)[number]
  brows: (typeof BROWS)[number]
  mouth: (typeof MOUTHS)[number]
  beard: (typeof BEARDS)[number]
  glasses: (typeof GLASSES)[number]
  hat: (typeof HATS)[number]
  extra: (typeof EXTRAS)[number]
  shirt: (typeof SHIRTS)[number]
}

const NAVY = '#141832'
const GOLD = '#F0A033'
const BLUE = '#2F5C9E'
const WHITE = '#FFFFFF'
const EYE = '#1A1D2E'
const LIP = '#5A2430'
const MOUTH_IN = '#7A2B33'
const TONGUE = '#E06A6A'

const SHIRT_STYLE: Record<PixelAvatar['shirt'], { base: string; dark: string; trim: string; crest: string }> = {
  titular: { base: BLUE, dark: '#244A83', trim: GOLD, crest: GOLD },
  branca: { base: '#EEF1F6', dark: '#C9D0DB', trim: NAVY, crest: BLUE },
  preta: { base: '#2A2C34', dark: '#1B1C22', trim: '#EEF1F6', crest: GOLD },
  goleiro: { base: GOLD, dark: '#C98422', trim: NAVY, crest: NAVY },
}

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16)
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)))
  const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255)
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)
}
function mix(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16)
  const c = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t)
  return '#' + ((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1)
}

const ell = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) =>
  ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1
const inHead = (x: number, y: number) => ell(x, y, 16, 14.5, 7, 8)

export function renderGrid(o: PixelAvatar): (string | undefined)[][] {
  const N = 32
  const g: (string | undefined)[][] = Array.from({ length: N }, () => Array<string | undefined>(N))
  const hm: boolean[][] = Array.from({ length: N }, () => Array<boolean>(N).fill(false))
  const set = (x: number, y: number, c: string) => { if (x >= 0 && y >= 0 && x < N && y < N) g[y][x] = c }
  const each = (fn: (x: number, y: number) => void) => { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) fn(x, y) }

  const skin = SKINS[o.skin] ?? SKINS[1]
  const skinS = shade(skin, -0.13)
  const skinD = shade(skin, -0.25)
  const H = HAIR_COLORS[o.hairColor] ?? HAIR_COLORS[0]
  const shaved = mix(H, skin, 0.5)
  const hair = (x: number, y: number, c = H) => { set(x, y, c); if (x >= 0 && y >= 0 && x < N && y < N) hm[y][x] = true }
  const shavedAt = (x: number, y: number) => hair(x, y, (x + y) % 2 ? shaved : mix(H, skin, 0.62))

  // 1. Cabelo de trás
  if (o.hair === 'longo') each((x, y) => { if (y >= 8 && y <= 22 && ell(x, y, 16, 15, 9.5, 12)) hair(x, y) })
  if (o.hair === 'mullet') each((x, y) => { if (y >= 12 && y <= 24 && ((x >= 7 && x <= 10) || (x >= 21 && x <= 24))) hair(x, y) })
  if (o.hair === 'dreads') for (const x of [7, 9, 22, 24]) for (let y = 12; y <= 24; y++) hair(x, y, y % 2 ? H : shade(H, -0.2))
  if (o.hair === 'coque') each((x, y) => { if (ell(x, y, 16, 4.6, 3.2, 2.6)) hair(x, y) })

  // 2. Camisa do clube
  const sh = SHIRT_STYLE[o.shirt] ?? SHIRT_STYLE.titular
  for (let y = 24; y < N; y++) {
    const w = Math.min(13, 5 + (y - 24) * 2)
    for (let x = 16 - w; x <= 15 + w; x++) set(x, y, x >= 13 + w ? sh.dark : sh.base)
    if (y >= 28) { set(8, y, sh.dark); set(23, y, sh.dark) }
  }
  // 3. Pescoço (com gola V)
  for (let y = 20; y <= 24; y++) for (let x = 13; x <= 18; x++) set(x, y, y <= 22 ? skinD : skinS)
  for (let x = 14; x <= 17; x++) set(x, 25, skinS)
  set(15, 26, skinS); set(16, 26, skinS)
  set(12, 24, sh.trim); set(19, 24, sh.trim); set(13, 25, sh.trim); set(18, 25, sh.trim)
  set(14, 26, sh.trim); set(17, 26, sh.trim); set(15, 27, sh.trim); set(16, 27, sh.trim)
  // escudo no peito
  set(20, 28, sh.crest); set(21, 28, sh.crest); set(20, 29, sh.crest); set(21, 29, sh.crest)
  set(20, 30, sh.dark); set(21, 30, sh.crest)

  // 4. Orelhas e cabeça
  for (let y = 13; y <= 16; y++) { set(8, y, skin); set(23, y, skinS) }
  set(8, 14, skinD); set(23, 14, skinD)
  each((x, y) => { if (inHead(x, y)) set(x, y, x >= 20 ? skinS : skin) })
  for (let x = 13; x <= 18; x++) set(x, 21, skinS)

  // 5. Olhos e sobrancelhas
  const eyeAt = (ex: number, right: boolean) => {
    const open = () => { set(ex, 14, WHITE); set(ex + 1, 14, EYE); set(ex, 15, EYE); set(ex + 1, 15, EYE) }
    switch (o.eyes) {
      case 'feliz': case 'chorando de rir':
        set(ex - 1, 15, EYE); set(ex, 14, EYE); set(ex + 1, 14, EYE); set(ex + 2, 15, EYE)
        if (o.eyes === 'chorando de rir') { set(ex, 16, '#7CC4F2'); set(ex + (right ? 1 : 0), 17, '#7CC4F2') }
        break
      case 'piscando':
        if (right) { set(ex - 1, 15, EYE); set(ex, 15, EYE); set(ex + 1, 15, EYE); set(ex + 2, 15, EYE) } else open()
        break
      case 'de lado': set(ex, 14, WHITE); set(ex, 15, WHITE); set(ex + 1, 14, EYE); set(ex + 1, 15, EYE); break
      case 'bravo': set(ex, 14, skinD); set(ex + 1, 14, skinD); set(ex, 15, EYE); set(ex + 1, 15, EYE); break
      case 'sono': set(ex, 14, skinS); set(ex + 1, 14, skinS); set(ex, 15, EYE); set(ex + 1, 15, EYE); set(ex + (right ? 2 : -1), 15, skinD); break
      case 'surpreso':
        for (let y = 13; y <= 15; y++) { set(ex, y, EYE); set(ex + 1, y, EYE) }
        set(ex, 13, WHITE)
        break
      default: open()
    }
  }
  eyeAt(12, false); eyeAt(18, true)

  const B = o.hairColor === 5 ? shade(H, -0.25) : shade(H, -0.05)
  const browAt = (ex: number, right: boolean) => {
    const inner = right ? ex : ex + 1, outer = right ? ex + 1 : ex
    switch (o.brows) {
      case 'grossa': for (let x = ex - 1; x <= ex + 2; x++) set(x, 12, B); set(ex, 11, B); set(ex + 1, 11, B); break
      case 'brava': set(outer, 11, B); set(inner, 12, B); set(right ? ex - 1 : ex + 2, 12, B); break
      case 'erguida': set(ex, 11, B); set(ex + 1, 11, B); set(right ? ex + 2 : ex - 1, 12, B); break
      case 'preocupada': set(inner, 11, B); set(outer, 12, B); break
      default: set(ex, 12, B); set(ex + 1, 12, B)
    }
  }
  browAt(12, false); browAt(18, true)
  if (o.brows === 'cortada') { set(19, 12, skin); set(19, 11, skinD) }

  // nariz
  set(15, 17, skinS); set(16, 17, skinD)

  // 6. Barba
  const B2 = shade(H, -0.08)
  const mouthBox = (x: number, y: number) => x >= 13 && x <= 18 && y >= 19 && y <= 20
  const sideburns = () => { for (let y = 12; y <= 17; y++) { set(9, y, B2); set(22, y, B2) } }
  const mustache = (wide: boolean) => {
    for (let x = wide ? 12 : 13; x <= (wide ? 19 : 18); x++) set(x, 18, B2)
    if (wide) { set(12, 19, B2); set(19, 19, B2); set(11, 19, B2); set(20, 19, B2) }
  }
  switch (o.beard) {
    case 'por fazer':
      each((x, y) => { if (inHead(x, y) && y >= 18 && !mouthBox(x, y) && (x + y) % 2 === 0) set(x, y, mix(skin, H, 0.45)) })
      break
    case 'cheia': case 'longa':
      each((x, y) => { if (inHead(x, y) && (y >= 18 || ((x <= 10 || x >= 21) && y >= 15)) && !mouthBox(x, y)) set(x, y, B2) })
      sideburns()
      if (o.beard === 'longa') each((x, y) => { if (y >= 21 && y <= 26 && ell(x, y, 16, 21, 5.2, 5.5)) set(x, y, B2) })
      break
    case 'cavanhaque':
      mustache(false)
      for (let y = 20; y <= 22; y++) for (let x = 14; x <= 17; x++) if (inHead(x, y) || y === 22) set(x, y, B2)
      break
    case 'bigode': mustache(false); break
    case 'bigodão': mustache(true); break
    case 'queixo':
      each((x, y) => { if (inHead(x, y) && !inHead(x, y + 1) || (inHead(x, y) && y >= 20 && (x <= 11 || x >= 20))) set(x, y, B2) })
      sideburns()
      break
    case 'costeleta':
      for (let y = 12; y <= 18; y++) { set(9, y, B2); set(10, y, B2); set(21, y, B2); set(22, y, B2) }
      break
  }

  // 7. Boca
  switch (o.mouth) {
    case 'risada':
      for (let x = 13; x <= 18; x++) set(x, 19, x === 13 || x === 18 ? LIP : WHITE)
      for (let x = 14; x <= 17; x++) set(x, 20, MOUTH_IN)
      set(15, 20, TONGUE); set(16, 20, TONGUE)
      break
    case 'neutro': for (let x = 14; x <= 17; x++) set(x, 19, LIP); break
    case 'canto': for (let x = 14; x <= 16; x++) set(x, 19, LIP); set(17, 18, LIP); break
    case 'aberta': set(15, 19, MOUTH_IN); set(16, 19, MOUTH_IN); set(15, 20, MOUTH_IN); set(16, 20, MOUTH_IN); set(15, 18, LIP); set(16, 18, LIP); break
    case 'lingua': set(13, 18, LIP); for (let x = 14; x <= 17; x++) set(x, 19, LIP); set(18, 18, LIP); set(16, 20, TONGUE); set(17, 20, TONGUE); break
    case 'dentuço': for (let x = 13; x <= 18; x++) set(x, 19, LIP); set(15, 20, WHITE); set(16, 20, WHITE); break
    case 'assobio': set(16, 19, MOUTH_IN); set(15, 19, LIP); set(17, 19, LIP); set(16, 18, LIP); set(16, 20, LIP); break
    case 'triste': set(13, 20, LIP); for (let x = 14; x <= 17; x++) set(x, 19, LIP); set(18, 20, LIP); break
    default: set(13, 18, LIP); for (let x = 14; x <= 17; x++) set(x, 19, LIP); set(18, 18, LIP)
  }

  // 8. Cabelo da frente
  const cap = (x: number, y: number, line = 9, side = 12) =>
    ell(x, y, 16, 13.5, 7.8, 8) && (y <= line || ((x <= 9 || x >= 22) && y <= side))
  switch (o.hair) {
    case 'careca': set(12, 8, shade(skin, 0.3)); set(13, 8, shade(skin, 0.3)); set(12, 9, shade(skin, 0.18)); break
    case 'raspado': each((x, y) => { if (inHead(x, y) && (y <= 9 || ((x <= 9 || x >= 22) && y <= 12))) shavedAt(x, y) }); break
    case 'tigela': each((x, y) => { if (cap(x, y, 11, 13)) hair(x, y) }); break
    case 'undercut':
      each((x, y) => { if (inHead(x, y) && y >= 9 && y <= 12 && (x <= 10 || x >= 21)) shavedAt(x, y) })
      each((x, y) => { if (ell(x, y, 16, 7.5, 8, 3.8) && y <= 9) hair(x, y) })
      break
    case 'moicano':
      each((x, y) => { if (inHead(x, y) && (y <= 9 || ((x <= 9 || x >= 22) && y <= 12))) shavedAt(x, y) })
      each((x, y) => { if (x >= 13 && x <= 18 && ell(x, y, 16, 6.5, 3.4, 5.5) && y <= 9) hair(x, y) })
      break
    case 'cacheado':
      each((x, y) => { if (y <= 13 && ell(x, y, 16, 11.5, 9, 7.5) && (y <= 10 || x <= 9 || x >= 22)) hair(x, y, (x * 2 + y) % 5 === 0 ? shade(H, 0.25) : H) })
      break
    case 'black':
      each((x, y) => { if (y <= 16 && ell(x, y, 16, 10.5, 11, 9.5) && (y <= 9 || x <= 9 || x >= 22)) hair(x, y, (x * 3 + y * 2) % 7 === 0 ? shade(H, 0.22) : H) })
      break
    default:
      each((x, y) => { if (cap(x, y)) hair(x, y) })
  }
  if (o.hair === 'topete') each((x, y) => { if (y <= 6 && ell(x, y, 15, 5.6, 5.2, 2.4)) hair(x, y) })
  if (o.hair === 'lateral') {
    for (let x = 9; x <= 16; x++) hair(x, 10)
    for (let x = 9; x <= 12; x++) hair(x, 11)
    hair(9, 12); hair(10, 12)
  }
  if (o.hair === 'espetado') for (const sx of [10, 13, 16, 19]) {
    hair(sx, 5); hair(sx + 1, 5); hair(sx + 1, 4); hair(sx + 2, 4); hair(sx + 2, 3)
  }
  if (o.hair === 'longo') {
    for (let y = 10; y <= 26; y++) for (const x of y <= 20 ? [8, 9, 10, 21, 22, 23] : [7, 8, 9, 10, 21, 22, 23, 24]) hair(x, y)
    set(16, 7, shade(H, -0.3)); set(16, 8, shade(H, -0.3))
  }
  if (o.hair === 'dreads') for (const x of [8, 10, 21, 23]) for (let y = 10; y <= 22; y++) hair(x, y, y % 2 ? shade(H, -0.18) : H)
  if (o.hair === 'coque') { hair(15, 7, shade(H, -0.3)); hair(16, 7, shade(H, -0.3)) }
  if (o.hair === 'mullet') for (let y = 13; y <= 17; y++) { hair(9, y); hair(22, y) }

  // sombra e brilho do cabelo
  each((x, y) => {
    if (!hm[y][x] || !g[y][x]) return
    const c = g[y][x]!
    if (c !== H) return
    if (y > 0 && !hm[y - 1][x] && x <= 15) g[y][x] = shade(H, o.hairColor === 0 ? 0.35 : 0.22)
    else if (x >= 20) g[y][x] = shade(H, -0.18)
  })

  // 9. Detalhes
  switch (o.extra) {
    case 'pintura do clube':
      for (const x of [12, 13, 18, 19]) { set(x, 16, BLUE); set(x, 17, GOLD) }
      break
    case 'sardas': for (const [x, y] of [[11, 16], [12, 17], [13, 16], [18, 16], [19, 17], [20, 16]]) set(x, y, skinD); break
    case 'bochecha': for (const x of [11, 12, 19, 20]) set(x, 17, mix(skin, '#E8707A', 0.45)); break
    case 'curativo': set(18, 17, '#EBCB9C'); set(19, 17, '#D9AE77'); set(20, 17, '#EBCB9C'); set(21, 17, '#EBCB9C'); break
    case 'brinco': set(8, 17, GOLD); set(23, 17, GOLD); break
  }

  // 10. Óculos
  if (o.glasses !== 'nenhum') {
    const F = o.glasses === 'esportivo' ? NAVY : '#2A2F45'
    if (o.glasses === 'esportivo') {
      for (let x = 10; x <= 21; x++) { set(x, 14, x % 4 === 1 ? '#FFD27A' : '#E8742F'); set(x, 15, '#C4561E') }
      set(9, 14, F); set(22, 14, F); set(9, 13, F); set(22, 13, F)
    } else {
      for (const x0 of [11, 17]) {
        const round = o.glasses === 'redondo'
        for (let x = x0; x <= x0 + 3; x++) { if (!(round && (x === x0 || x === x0 + 3))) { set(x, 13, F); set(x, 16, F) } }
        for (let y = 14; y <= 15; y++) { set(x0, y, F); set(x0 + 3, y, F) }
        if (o.glasses === 'escuro') { for (let x = x0 + 1; x <= x0 + 2; x++) for (let y = 14; y <= 15; y++) set(x, y, '#1F2440'); set(x0 + 1, 14, '#5A6480') }
      }
      set(15, 14, F); set(16, 14, F); set(9, 14, F); set(10, 14, F); set(21, 14, F); set(22, 14, F)
    }
  }

  // 11. Chapéu (esconde o cabelo que sobra acima)
  const covers = o.hat === 'boné' || o.hat === 'boné pra trás' || o.hat === 'touca'
  if (covers) each((x, y) => { if (hm[y][x] && y <= 9) { g[y][x] = undefined; hm[y][x] = false } })
  const dome = (x: number, y: number) => y <= 10 && ell(x, y, 16, 10, 8.4, 6)
  if (o.hat === 'boné' || o.hat === 'boné pra trás') {
    each((x, y) => { if (dome(x, y)) set(x, y, x >= 20 ? '#1C2244' : NAVY) })
    if (o.hat === 'boné') {
      for (let x = 8; x <= 24; x++) set(x, 10, '#1C2244')
      for (let x = 17; x <= 25; x++) set(x, 11, '#262D55')
      set(15, 6, GOLD); set(16, 6, GOLD); set(15, 7, GOLD); set(16, 5, GOLD)
    } else {
      for (let x = 9; x <= 23; x++) set(x, 10, '#262D55')
      for (let x = 5; x <= 8; x++) set(x, 9, '#1C2244')
      set(14, 9, GOLD); set(15, 9, '#C9CED6')
    }
  }
  if (o.hat === 'touca') {
    each((x, y) => { if (dome(x, y)) set(x, y, y >= 9 ? (x % 2 ? GOLD : '#D88A20') : (x >= 20 ? '#244A83' : BLUE)) })
    for (let y = 2; y <= 3; y++) for (let x = 15; x <= 16; x++) set(x, y, GOLD)
    set(15, 2, '#FFD27A')
  }
  if (o.hat === 'faixa') for (let x = 8; x <= 23; x++) { set(x, 10, x === 8 || x === 23 ? shade(GOLD, -0.15) : GOLD); if (inHead(x, 11) || x === 8 || x === 23) set(x, 11, shade(GOLD, -0.2)) }
  if (o.hat === 'coroa') {
    for (let x = 10; x <= 21; x++) { set(x, 5, GOLD); set(x, 4, GOLD); set(x, 6, shade(GOLD, -0.25)) }
    for (const px of [10, 15, 16, 21]) { set(px, 3, GOLD); set(px, 2, GOLD) }
    set(13, 3, GOLD); set(18, 3, GOLD)
    set(15, 1, WHITE); set(16, 1, WHITE); set(13, 4, '#E85A5A'); set(18, 4, '#4CC38A')
  }

  return g
}

export function pixelAvatarSvg(o: PixelAvatar, background?: string): string {
  const g = renderGrid(o)
  let rects = ''
  for (let y = 0; y < g.length; y++) {
    let x = 0
    while (x < g[y].length) {
      const c = g[y][x]
      if (!c) { x++; continue }
      let w = 1
      while (x + w < g[y].length && g[y][x + w] === c) w++
      rects += `<rect x="${x}" y="${y}" width="${w}" height="1" fill="${c}"/>`
      x += w
    }
  }
  const bg = background ? `<rect x="0" y="0" width="32" height="32" fill="${background}"/>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="2 1 28 28" shape-rendering="crispEdges">${bg}${rects}</svg>`
}

const pick = <T,>(arr: readonly T[], r: () => number) => arr[Math.floor(r() * arr.length)]

function rng(seed: string) {
  let h = 2166136261
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

function build(r: () => number): PixelAvatar {
  return {
    v: 4,
    skin: Math.floor(r() * SKINS.length),
    hair: pick(HAIRS, r),
    hairColor: Math.floor(r() * 5),
    eyes: pick(['normal', 'normal', 'feliz', 'piscando', 'de lado', 'bravo', 'sono'] as const, r),
    brows: pick(['normal', 'normal', 'grossa', 'brava', 'erguida'] as const, r),
    mouth: pick(['sorriso', 'sorriso', 'risada', 'canto', 'neutro', 'lingua'] as const, r),
    beard: r() < 0.45 ? 'nenhuma' : pick(BEARDS.slice(1), r),
    glasses: r() < 0.8 ? 'nenhum' : pick(GLASSES.slice(1), r),
    hat: r() < 0.85 ? 'nenhum' : pick(HATS.slice(1), r),
    extra: r() < 0.75 ? 'nenhum' : pick(EXTRAS.slice(1), r),
    shirt: 'titular',
  }
}

export const randomPixelAvatar = () => build(Math.random)
export const seededPixelAvatar = (seed: string) => build(rng(seed || 'marditos'))

/** Aceita o kit pixel anterior (v2) e completa os campos novos. */
export function upgradePixelAvatar(o: unknown): PixelAvatar | null {
  if (!o || typeof o !== 'object') return null
  const a = o as Record<string, unknown>
  if (a.v === 4) return a as unknown as PixelAvatar
  if (a.v === 2) return { brows: 'normal', extra: 'nenhum', shirt: 'titular', ...(a as object), v: 4 } as PixelAvatar
  return null
}
