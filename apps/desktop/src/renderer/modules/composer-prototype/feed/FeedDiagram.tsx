import {
  ArrowDown,
  ArrowDownLeft,
  ArrowDownRight,
  Code2,
  Expand,
  Maximize,
  Minus,
  Plus,
  Workflow,
} from 'lucide-react'
import { useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/renderer/components/ui/alert'
import { Button } from '@/renderer/components/ui/button'
import { FEED_EVIDENCE, type FeedEvidenceAction, MERMAID_SOURCE } from './evidence'
import { FEED_CARD_RADIUS_CLASS } from './feedSurface'

export function DiagramDrawing({ scale = 100 }: { scale?: number }) {
  return (
    <div
      role="img"
      className="flex min-w-64 flex-col items-center justify-center gap-2 p-6 text-control"
      style={{ transform: `scale(${scale / 100})` }}
      aria-label="Draft and attachments go to the Session driver, which routes to Claude through a PTY or Codex through JSON-RPC. Both return activity to the Feed."
    >
      <div className="rounded-lg border bg-card px-4 py-2">Draft + attachments</div>
      <ArrowDown className="!size-(--size-icon-inline) text-muted-foreground" />
      <div className="rounded-lg border bg-card px-4 py-2 font-medium">Session driver</div>
      <div className="flex w-full justify-evenly text-muted-foreground">
        <ArrowDownLeft className="!size-(--size-icon-inline)" />
        <ArrowDownRight className="!size-(--size-icon-inline)" />
      </div>
      <div className="flex w-full justify-center gap-4">
        <div className="rounded-lg border bg-card px-3 py-2">
          Claude <span className="text-muted-foreground">PTY</span>
        </div>
        <div className="rounded-lg border bg-card px-3 py-2">
          Codex <span className="text-muted-foreground">JSON-RPC</span>
        </div>
      </div>
      <div className="flex w-full justify-evenly text-muted-foreground">
        <ArrowDownRight className="!size-(--size-icon-inline)" />
        <ArrowDownLeft className="!size-(--size-icon-inline)" />
      </div>
      <div className="rounded-lg border bg-muted px-5 py-2 font-medium">Feed</div>
    </div>
  )
}

export function FeedDiagram({ onOpen }: { onOpen: FeedEvidenceAction }) {
  const [source, setSource] = useState(false)
  const [scale, setScale] = useState(100)
  return (
    <figure
      className={`overflow-hidden border border-border bg-card ${FEED_CARD_RADIUS_CLASS}`}
      data-component="FeedMermaid"
    >
      <figcaption className="flex items-center justify-between border-b border-border/60 px-3 py-2 text-control">
        <span className="font-medium">From draft to Feed</span>
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label={source ? 'Show rendered diagram' : 'Show diagram source'}
          onClick={() => setSource(!source)}
        >
          {source ? <Workflow /> : <Code2 />}
        </Button>
      </figcaption>
      <div className="relative h-80">
        <div className="h-full overflow-auto pb-10">
          {source ? (
            <pre className="p-4 font-mono text-control leading-relaxed">{MERMAID_SOURCE}</pre>
          ) : (
            <DiagramDrawing scale={scale} />
          )}
        </div>
        <div className="absolute right-2 bottom-2 flex items-center gap-1 rounded-lg border bg-popover p-1 text-control">
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Zoom diagram out"
            onClick={() => setScale(Math.max(50, scale - 25))}
          >
            <Minus className="!size-(--size-icon-control)" />
          </Button>
          <span className="min-w-10 text-center tabular-nums">{scale}%</span>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Zoom diagram in"
            onClick={() => setScale(Math.min(200, scale + 25))}
          >
            <Plus className="!size-(--size-icon-control)" />
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Fit diagram"
            onClick={() => setScale(100)}
          >
            <Maximize className="!size-(--size-icon-control)" />
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Expand diagram in sidebar"
            onClick={() => onOpen(FEED_EVIDENCE.diagram)}
          >
            <Expand className="!size-(--size-icon-control)" />
          </Button>
        </div>
      </div>
    </figure>
  )
}

export function FeedDiagramState({ loading = false }: { loading?: boolean }) {
  return (
    <figure className={`overflow-hidden border border-border bg-card ${FEED_CARD_RADIUS_CLASS}`}>
      <figcaption className="border-b border-border/60 px-3 py-2 text-control">
        Mermaid · {loading ? 'Loading' : 'Could not render'}
      </figcaption>
      <div className="relative h-80 overflow-hidden">
        {loading ? (
          <div
            className="flex h-full items-center justify-center text-control text-muted-foreground"
            role="status"
          >
            Preparing diagram…
          </div>
        ) : (
          <pre className="h-full overflow-auto p-4 pb-28 font-mono text-control">
            {
              'flowchart LR\n  Draft --> Session[\n  Session --> Feed\n\nExpected a closing bracket after "Session".'
            }
          </pre>
        )}
        {!loading && (
          <Alert variant="destructive" className="absolute right-3 bottom-3 left-3 w-auto">
            <AlertTitle className="text-control">The diagram source is incomplete</AlertTitle>
            <AlertDescription className="text-control">
              The original source remains available above.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </figure>
  )
}
