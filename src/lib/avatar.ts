import type { AvatarOptions } from './types'
import { pixelAvatarSvg, randomPixelAvatar, seededPixelAvatar, upgradePixelAvatar } from './pixelAvatar'

export { SKINS, HAIR_COLORS, HAIRS, EYES, BROWS, MOUTHS, BEARDS, GLASSES, HATS, EXTRAS, SHIRTS, label } from './pixelAvatar'

export const randomAvatar = (): AvatarOptions => randomPixelAvatar()
export const defaultAvatar = (seed: string): AvatarOptions => seededPixelAvatar(seed)
/** Avatar no formato atual; formatos antigos são convertidos ou trocados pelo padrão do nome. */
export const ensureAvatar = (o: unknown, seed: string): AvatarOptions => upgradePixelAvatar(o) ?? seededPixelAvatar(seed)

const cache = new Map<string, string>()

export function avatarUri(opts: AvatarOptions | null | undefined, seed = 'marditos'): string {
  const o = ensureAvatar(opts, seed)
  const key = JSON.stringify(o)
  const hit = cache.get(key)
  if (hit) return hit
  const uri = 'data:image/svg+xml;utf8,' + encodeURIComponent(pixelAvatarSvg(o))
  cache.set(key, uri)
  return uri
}
