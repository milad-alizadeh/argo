import { FileCode2, FileText, ImageIcon, SquareTerminal, Workflow } from 'lucide-react'
import type { FeedPrototypeEvidence } from './evidence'
import { DiagramDrawing } from './FeedDiagram'
import { HighlightedCode } from './FeedPrimitives'

export function EvidenceKindIcon({ kind }: { kind: FeedPrototypeEvidence['kind'] }) {
  switch (kind) {
    case 'code':
    case 'diff':
      return <FileCode2 className="!size-(--size-icon-control)" />
    case 'output':
      return <SquareTerminal className="!size-(--size-icon-control)" />
    case 'document':
      return <FileText className="!size-(--size-icon-control)" />
    case 'diagram':
      return <Workflow className="!size-(--size-icon-control)" />
    case 'image':
      return <ImageIcon className="!size-(--size-icon-control)" />
  }
}

function DiffLine({ line }: { line: string }) {
  let tone = 'text-foreground'
  if (line.startsWith('+')) tone = 'bg-muted font-medium text-foreground'
  if (line.startsWith('-')) tone = 'bg-destructive/10 text-destructive'
  return <span className={`block min-w-fit ${tone}`}>{line || ' '}</span>
}

export function EvidenceBody({ evidence }: { evidence: FeedPrototypeEvidence }) {
  switch (evidence.kind) {
    case 'image':
      return (
        <img
          src={evidence.source}
          alt="Two people reviewing work on a laptop"
          width={320}
          height={213}
          className="h-auto w-full rounded-md object-contain"
        />
      )
    case 'diagram':
      return (
        <div className="overflow-auto rounded-lg border bg-background">
          <DiagramDrawing />
        </div>
      )
    case 'diff':
      return (
        <pre className="overflow-x-auto font-mono text-control leading-relaxed">
          {evidence.source.split('\n').map((line) => (
            <DiffLine key={line} line={line} />
          ))}
        </pre>
      )
    case 'document':
      return <div className="whitespace-pre-wrap text-body leading-relaxed">{evidence.source}</div>
    case 'code':
      return (
        <pre className="overflow-x-auto font-mono text-control leading-relaxed">
          <HighlightedCode source={evidence.source} />
        </pre>
      )
    case 'output':
      return (
        <pre className="overflow-x-auto font-mono text-control leading-relaxed">
          <code>{evidence.source}</code>
        </pre>
      )
  }
}
