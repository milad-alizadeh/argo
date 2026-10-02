import { drawnColor } from './browser-fixture'

function luminance(color: number[]) {
  const linear = color.slice(0, 3).map((channel) => {
    const normalized = channel / 255
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0)
}

export function contrastRatio(foreground: string, background: string, ground?: string) {
  const surface = drawnColor(background)
  if (ground) {
    const underlay = drawnColor(ground)
    const alpha = (surface[3] ?? 0) / 255
    for (let channel = 0; channel < 3; channel++) {
      surface[channel] = (surface[channel] ?? 0) * alpha + (underlay[channel] ?? 0) * (1 - alpha)
    }
  }
  const first = luminance(drawnColor(foreground))
  const second = luminance(surface)
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}
