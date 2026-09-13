import type { ReactNode } from 'react'
import { Command, FileText, Plug, WandSparkles, type LucideIcon } from 'lucide-react'
import { Badge } from '../../../components/ui/badge'

export type SessionReferenceKind = 'command' | 'file' | 'plugin' | 'skill'

export type SessionReference = {
  detail: string
  kind: SessionReferenceKind
  label: string
  source: string
}

export const sessionReferences = [
  { detail: 'Build an approved ticket', kind: 'command', label: 'Implement', source: '/implement' },
  { detail: 'Pressure-test the brief', kind: 'command', label: 'Grill Me', source: '/grill-me' },
  { detail: 'Compress the task context', kind: 'command', label: 'Compact', source: '/compact' },
  { detail: 'Repository instructions', kind: 'file', label: 'AGENTS.md', source: '@AGENTS.md' },
  { detail: 'Current desktop folder', kind: 'file', label: 'apps/desktop', source: '@apps/desktop' },
  {
    detail: 'Frequently used skill',
    kind: 'skill',
    label: '$frontend-design',
    source: '@$frontend-design',
  },
  {
    detail: 'Managed Claude permission plugin',
    kind: 'plugin',
    label: 'Argo Session plugin',
    source: '@argo-plugin',
  },
] as const satisfies readonly SessionReference[]

const escapedSources = sessionReferences.map((reference) =>
  reference.source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
)
const sourcePattern = new RegExp(`(^|\\s)(${escapedSources.join('|')})(?=\\s|$)`, 'g')

const referenceIcons: Record<SessionReferenceKind, LucideIcon> = {
  command: Command,
  file: FileText,
  plugin: Plug,
  skill: WandSparkles,
}

export function SessionReferenceIcon({ kind }: { kind: SessionReferenceKind }) {
  const Icon = referenceIcons[kind]
  return <Icon aria-hidden="true" className="size-3.5" />
}

function referenceBySource(source: string) {
  return sessionReferences.find((reference) => reference.source === source)
}

export function referenceInText(text: string) {
  const match = sourcePattern.exec(text)
  sourcePattern.lastIndex = 0
  if (match === null || match.index === undefined) return null
  const source = match[2]
  if (source === undefined) return null
  return {
    end: match.index + match[0].length,
    source,
    start: match.index + (match[1]?.length ?? 0),
  }
}

export function SessionReferenceBadge({ source }: { source: string }) {
  const reference = referenceBySource(source)
  return (
    <Badge className="mx-0.5 align-text-bottom font-mono text-meta" variant="outline">
      {reference ? <SessionReferenceIcon kind={reference.kind} /> : null}
      {source}
    </Badge>
  )
}

export function SessionReferenceText({ text }: { text: string }) {
  const fragments: ReactNode[] = []
  let cursor = 0
  let match = referenceInText(text)
  while (match !== null) {
    if (cursor < match.start) fragments.push(text.slice(cursor, match.start))
    fragments.push(
      <SessionReferenceBadge key={`${match.start}:${match.source}`} source={match.source} />,
    )
    cursor = match.end
    match = referenceInText(text.slice(cursor))
    if (match !== null) match = { ...match, end: match.end + cursor, start: match.start + cursor }
  }
  if (cursor < text.length) fragments.push(text.slice(cursor))
  return fragments
}

export function referenceSuggestions(trigger: '/' | '@', query: string) {
  const loweredQuery = query.toLowerCase()
  const suggestions = sessionReferences.filter((reference) => reference.source.startsWith(trigger))
  return suggestions.filter((reference) =>
    `${reference.label} ${reference.detail} ${reference.source}`
      .toLowerCase()
      .includes(loweredQuery),
  )
}
