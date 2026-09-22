import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FEED_CARD_RADIUS_CLASS } from '@/domains/sessions/renderer/feed/content/feed-surface'
import { mermaidThemeVariables } from '@/domains/sessions/renderer/feed/content/mermaid-theme'
import { useDarkAppearance } from '@/platform/renderer/use-appearance'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { Button } from '@/platform/renderer/components/ui/button'

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

// The approved honest state for a fence Mermaid could not draw: the source stays readable and the
// reader is told plainly that it, not Argo, is incomplete.
function DiagramFailure({ source }: { source: string }) {
  const { t } = useTranslation('sessions')
  return (
    <div className="relative">
      <pre className="max-h-64 overflow-x-hidden overflow-y-auto p-4 pb-20 font-mono type-code whitespace-pre-wrap wrap-anywhere">
        {source}
      </pre>
      <div
        role="alert"
        className="absolute inset-x-3 bottom-3 rounded-lg border border-destructive/30 bg-card px-3 py-2 text-destructive"
      >
        <p className="type-meta font-medium">{t('diagram.incomplete')}</p>
        <p className="type-meta">{t('diagram.sourceAvailable')}</p>
      </div>
    </div>
  )
}

// A `mermaid` fence drawn as its diagram; one Mermaid cannot parse shows its source instead, and
// a drawn diagram offers `onOpen` as the approved way to inspect it beside the Feed (#1836).
export function FeedMermaid({
  source,
  active = false,
  onOpen,
}: {
  source: string
  active?: boolean
  onOpen?: () => void
}) {
  const { t } = useTranslation('sessions')
  const frame = useRef<HTMLDivElement>(null)
  // `useId` answers `_r_1_`-shaped ids, and Mermaid uses the id as a CSS selector.
  const diagramId = `mermaid-${useId().replace(/[^\w-]/g, '')}`
  const dark = useDarkAppearance()
  const [drawing, setDrawing] = useState<Drawing>('pending')
  useEffect(() => {
    let current = true
    drawDiagram(diagramId, source, dark).then(
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
  }, [diagramId, source, dark])
  return (
    <figure
      aria-current={active ? 'true' : undefined}
      className={`overflow-hidden border bg-card ${active ? 'border-primary' : 'border-border'} ${FEED_CARD_RADIUS_CLASS}`}
      data-component="FeedMermaid"
    >
      <figcaption className="flex items-center justify-between border-b border-border/60 px-3 py-2 type-control">
        <span className="font-medium">
          {drawing === 'failed' ? t('diagram.failedTitle') : t('diagram.title')}
        </span>
        {drawing === 'drawn' && onOpen ? (
          <Button size="icon-xs" variant="ghost" aria-label={t('diagram.expand')} onClick={onOpen}>
            <Icon name="expand" className="!size-(--size-icon-control)" />
          </Button>
        ) : null}
      </figcaption>
      {drawing === 'failed' ? (
        <DiagramFailure source={source} />
      ) : (
        <div
          aria-busy={drawing === 'pending'}
          className="flex min-h-16 justify-center overflow-x-auto p-4"
          ref={frame}
        />
      )}
    </figure>
  )
}
