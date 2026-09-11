import { FileCode2, FileText, ImageIcon, SquareTerminal, Workflow } from 'lucide-react'
import {
  Terminal,
  TerminalContent,
  TerminalCopyButton,
  TerminalHeader,
  TerminalTitle,
} from '@/components/ai-elements/terminal'
import type { FeedPrototypeEvidence } from './evidence'
import { DiagramDrawing } from './FeedDiagram'
import { FeedCode } from './FeedPrimitives'

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
  if (line.startsWith('+')) tone = 'bg-surface-inset font-medium text-foreground'
  if (line.startsWith('-')) tone = 'bg-destructive/10 text-destructive'
  return <span className={`block min-w-fit ${tone}`}>{line || ' '}</span>
}

export function FeedMarkdown({ source }: { source: string }) {
  return (
    <div className="space-y-4 type-prose">
      {source.split('\n\n').map((block) => {
        if (block.startsWith('# ')) {
          return (
            <h2 key={block} className="type-heading font-semibold">
              {block.slice(2)}
            </h2>
          )
        }
        if (block.startsWith('## ')) {
          return (
            <h3 key={block} className="type-heading font-semibold">
              {block.slice(3)}
            </h3>
          )
        }
        if (block.startsWith('- ')) {
          return (
            <ul key={block} className="list-disc space-y-1 pl-5">
              {block.split('\n').map((line) => (
                <li key={line}>{line.slice(2)}</li>
              ))}
            </ul>
          )
        }
        return <p key={block}>{block}</p>
      })}
    </div>
  )
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
        <div className="overflow-auto rounded-lg border bg-surface-raised">
          <DiagramDrawing />
        </div>
      )
    case 'diff':
      return (
        <pre className="overflow-x-auto font-mono type-code">
          {evidence.source.split('\n').map((line) => (
            <DiffLine key={line} line={line} />
          ))}
        </pre>
      )
    case 'document':
      return <FeedMarkdown source={evidence.source} />
    case 'code':
      return <FeedCode source={evidence.source} />
    case 'output':
      return (
        <Terminal output={evidence.source} aria-label={evidence.title}>
          <TerminalHeader>
            <TerminalTitle className="type-meta" />
            <TerminalCopyButton />
          </TerminalHeader>
          <TerminalContent className="type-code" />
        </Terminal>
      )
  }
}
