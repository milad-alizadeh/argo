import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { FeedCode } from './FeedCode'
import { FEED_CARD_RADIUS_CLASS } from './feedSurface'
import { mermaidThemeVariables } from './mermaidTheme'

// `useAppearance` puts `.dark` on the root element; a diagram redraws when it changes.
function subscribeToAppearance(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributeFilter: ['class'] })
  return () => observer.disconnect()
}

const isDark = () => document.documentElement.classList.contains('dark')

type Drawing = 'pending' | 'drawn' | 'failed'

// Mermaid is loaded on the first diagram, so a feed with none never pays for it. `strict` runs every
// label through DOMPurify and turns off click handlers, so the SVG it returns holds no script.
async function drawDiagram(id: string, source: string, dark: boolean) {
  const { default: mermaid } = await import('mermaid')
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    look: 'neo',
    themeVariables: mermaidThemeVariables(dark),
    // A `[box]` node is a bare rect, which the theme's radius never reaches.
    themeCSS: '.node rect { rx: 6px; ry: 6px; }',
  })
  if (!(await mermaid.parse(source, { suppressErrors: true }))) return null
  return (await mermaid.render(id, source)).svg
}

// A `mermaid` fence drawn as its diagram; one Mermaid cannot parse shows its source instead.
export function FeedMermaid({ source }: { source: string }) {
  const frame = useRef<HTMLElement>(null)
  // `useId` answers `_r_1_`-shaped ids, and Mermaid uses the id as a CSS selector.
  const id = `mermaid-${useId().replace(/[^\w-]/g, '')}`
  const dark = useSyncExternalStore(subscribeToAppearance, isDark)
  const [drawing, setDrawing] = useState<Drawing>('pending')
  useEffect(() => {
    let current = true
    drawDiagram(id, source, dark).then(
      (svg) => {
        if (!current) return
        if (svg && frame.current) frame.current.innerHTML = svg
        setDrawing(svg ? 'drawn' : 'failed')
      },
      () => current && setDrawing('failed'),
    )
    return () => {
      current = false
    }
  }, [id, source, dark])
  if (drawing === 'failed') return <FeedCode source={source} language="mermaid" />
  return (
    <figure
      aria-busy={drawing === 'pending'}
      aria-label="Mermaid diagram"
      className={`flex min-h-16 justify-center overflow-x-auto border bg-card p-4 ${FEED_CARD_RADIUS_CLASS}`}
      ref={frame}
    />
  )
}
