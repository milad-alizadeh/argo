// The URLs a Feed may open or load (#1835). Links open in the default browser and never in the
// window; images load from anywhere the renderer's CSP `img-src` allows.
const EXTERNAL_PROTOCOLS = new Set(['https:', 'http:', 'mailto:'])
const IMAGE_PROTOCOLS = new Set(['https:', 'http:', 'file:'])

export function isExternalLink(value: string): boolean {
  if (!URL.canParse(value)) return false
  return EXTERNAL_PROTOCOLS.has(new URL(value).protocol)
}

// A relative path is refused, because a Feed row does not carry the Session's folder to resolve it
// against. '' is the refusal, drawn as the image failure.
export function loadableImageSource(value: string): string {
  if (value.startsWith('/')) return new URL(`file://${encodeURI(value)}`).href
  if (/^data:image\//i.test(value)) return value
  if (!URL.canParse(value)) return ''
  return IMAGE_PROTOCOLS.has(new URL(value).protocol) ? value : ''
}
