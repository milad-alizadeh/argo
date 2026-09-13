// Mermaid parses colours with khroma, which reads no `oklch()`, so each token is painted onto a
// one-pixel canvas and read back as sRGB.
function tokenColor(context: CanvasRenderingContext2D, token: string) {
  context.clearRect(0, 0, 1, 1)
  context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(token)
  context.fillRect(0, 0, 1, 1)
  const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data
  return `rgba(${red}, ${green}, ${blue}, ${(alpha ?? 255) / 255})`
}

// Mermaid's `base` theme drawn in the app's tokens, so a diagram follows the appearance.
export function mermaidThemeVariables(dark: boolean) {
  const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  if (!context) return {}
  const color = (token: string) => tokenColor(context, token)
  const surface = color('--card')
  const node = color('--muted')
  const text = color('--foreground')
  const edge = color('--muted-foreground')
  const outline = color('--border')
  const body = getComputedStyle(document.body)
  return {
    darkMode: dark,
    background: surface,
    fontFamily: body.fontFamily,
    fontSize: body.fontSize,
    dropShadow: 'none',
    primaryColor: node,
    primaryTextColor: text,
    primaryBorderColor: outline,
    secondaryColor: color('--secondary'),
    tertiaryColor: color('--accent'),
    lineColor: edge,
    textColor: text,
    clusterBkg: color('--background'),
    clusterBorder: color('--border'),
    edgeLabelBackground: surface,
    noteBkgColor: node,
    noteTextColor: text,
    noteBorderColor: outline,
  }
}
