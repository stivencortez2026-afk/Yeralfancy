/**
 * Converts a Supabase Storage URL to use the image render endpoint,
 * which serves a resized/compressed version via CDN.
 * Falls back to the original URL for non-Supabase images.
 */
export function imgSrc(url, width = 800, quality = 80) {
  if (!url) return ''
  if (!url.includes('/storage/v1/object/public/')) return url
  return (
    url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/') +
    `?width=${width}&quality=${quality}&resize=cover`
  )
}

/**
 * Returns the URL of the product's cover photo (the one chosen in
 * producto.capa.indice), falling back to the first photo.
 */
export function fotoCapa(producto) {
  const fotos = producto?.fotos || []
  const i = producto?.capa?.indice
  return (Number.isInteger(i) && fotos[i]) || fotos[0] || ''
}

export const ZOOM_MIN = 0.5
export const ZOOM_MAX = 2.5

/**
 * Normalizes producto.capa into { indice, zoom, x, y, v: 2 }.
 * Framings saved by the pre-v2 editor with zoom baked in (zoom !== 1 and no
 * v marker) used different math and point at the wrong region — those render
 * centered and without zoom, exactly as they do today.
 */
export function normalizarCapa(capa) {
  if (!capa) return null
  const indice = Number.isInteger(capa.indice) ? capa.indice : 0
  const esLegadoConZoom = !(Number(capa.v) >= 2) && (Number(capa.zoom) || 1) !== 1
  if (esLegadoConZoom) return { indice, zoom: 1, x: 50, y: 50, v: 2 }
  return { indice, zoom: clampZoom(capa.zoom), x: clampPct(capa.x), y: clampPct(capa.y), v: 2 }
}

/**
 * Inline style for cover images (object-cover): focal point via
 * objectPosition and optional zoom via scale() anchored on that same point,
 * so the chosen center stays fixed while zooming.
 */
export function estiloCapa(capa) {
  const c = normalizarCapa(capa)
  if (!c) return undefined
  const estilo = {}
  if (c.x !== 50 || c.y !== 50) estilo.objectPosition = `${c.x}% ${c.y}%`
  if (c.zoom !== 1) {
    estilo.transform = `scale(${c.zoom})`
    estilo.transformOrigin = `${c.x}% ${c.y}%`
  }
  return estilo.objectPosition || estilo.transform ? estilo : undefined
}

/** Effective zoom of a capa (1 when unset or legacy). */
export function zoomCapa(capa) {
  return normalizarCapa(capa)?.zoom ?? 1
}

function clampZoom(v) {
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) return 1
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, n))
}

function clampPct(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return 50
  return Math.min(100, Math.max(0, n))
}
