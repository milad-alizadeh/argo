import type { ReactNode } from 'react'

export type DiffLine = {
  kind: 'added' | 'context' | 'hunk' | 'removed' | 'title'
  newLine: number | null
  oldLine: number | null
  source: string
}

export function diffLines(source: string): DiffLine[] {
  let oldLine = 0
  let newLine = 0
  return source
    .replace(/\n$/, '')
    .split('\n')
    .map((line) => {
      const matched = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)
      if (matched !== null) {
        oldLine = Number(matched[1])
        newLine = Number(matched[2])
        return { kind: 'hunk', oldLine: null, newLine: null, source: line }
      }
      if (line.startsWith('-'))
        return { kind: 'removed', oldLine: oldLine++, newLine: null, source: line }
      if (line.startsWith('+'))
        return { kind: 'added', oldLine: null, newLine: newLine++, source: line }
      if (line.startsWith(' '))
        return { kind: 'context', oldLine: oldLine++, newLine: newLine++, source: line }
      return { kind: 'title', oldLine: null, newLine: null, source: line }
    })
}

export function diffLineDecoration(line: DiffLine): { className?: string; prefix: ReactNode } {
  let className: string | undefined
  switch (line.kind) {
    case 'added':
      className = 'bg-emerald-500/15 [&_span:last-child]:bg-emerald-500/10'
      break
    case 'removed':
      className = 'bg-rose-500/15 [&_span:last-child]:bg-rose-500/10'
      break
    case 'context':
    case 'title':
      break
    case 'hunk':
      className = 'hidden'
      break
  }
  const displayedLine = line.kind === 'removed' ? line.oldLine : line.newLine
  return {
    className,
    prefix: (
      <span
        aria-hidden="true"
        className="mr-2 w-6 shrink-0 text-right text-muted-foreground select-none"
      >
        {displayedLine ?? ''}
      </span>
    ),
  }
}
