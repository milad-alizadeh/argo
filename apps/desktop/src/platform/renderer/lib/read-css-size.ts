export function readCssSize(token: string): number {
  const root = document.documentElement
  const value = getComputedStyle(root).getPropertyValue(token).trim()
  return resolveCssLength(value)
}

export function resolveCssLength(value: string): number {
  const root = document.documentElement
  if (!value || !CSS.supports('width', value) || value === 'auto') {
    throw new Error(`Invalid CSS length: ${value}`)
  }
  const probe = document.createElement('div')
  probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;height:0;'
  probe.style.width = value
  root.append(probe)
  try {
    const resolved = getComputedStyle(probe).width
    const pixels = resolved.endsWith('px') ? Number(resolved.slice(0, -2)) : Number.NaN
    if (!Number.isFinite(pixels)) throw new Error(`Unresolved CSS length: ${value}`)
    return pixels
  } finally {
    probe.remove()
  }
}
