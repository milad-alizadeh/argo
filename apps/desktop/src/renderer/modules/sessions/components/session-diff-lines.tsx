import type { ReactNode } from 'react'

type DiffLine = {
  kind: 'added' | 'context' | 'removed' | 'title'
  newLine: number | null
  oldLine: number | null
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
        return { kind: 'title', oldLine: null, newLine: null }
      }
      if (line.startsWith('-')) return { kind: 'removed', oldLine: oldLine++, newLine: null }
      if (line.startsWith('+')) return { kind: 'added', oldLine: null, newLine: newLine++ }
      if (line.startsWith(' ')) return { kind: 'context', oldLine: oldLine++, newLine: newLine++ }
      return { kind: 'title', oldLine: null, newLine: null }
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
  }
  return {
    className,
    prefix: (
      <span
        aria-hidden="true"
        className="mr-2 grid w-12 shrink-0 grid-cols-2 gap-1 text-right text-muted-foreground select-none"
      >
        <span>{line.oldLine ?? ''}</span>
        <span>{line.newLine ?? ''}</span>
      </span>
    ),
  }
}
