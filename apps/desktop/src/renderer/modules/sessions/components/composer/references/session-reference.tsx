import { FileText, type LucideIcon, Plug, TriangleAlert, WandSparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { HARNESSES, type SessionCli } from '../../../harness/harnesses'
import { InlineContext } from './inline-context'

export type SessionReferenceKind = 'command' | 'file' | 'plugin' | 'skill'

export type SessionReference = {
  detail: string
  kind: SessionReferenceKind
  label: string
  source: string
  // Every CLI supports a reference unless this names the closed set that does; a plugin invoking
  // Claude's own permission system has no Codex equivalent to name.
  cli?: readonly SessionCli[]
}

export const sessionReferences = [
  { detail: 'Build an approved ticket', kind: 'command', label: 'Implement', source: '/implement' },
  { detail: 'Pressure-test the brief', kind: 'command', label: 'Grill Me', source: '/grill-me' },
  { detail: 'Compress the task context', kind: 'command', label: 'Compact', source: '/compact' },
  { detail: 'Repository instructions', kind: 'file', label: 'AGENTS.md', source: '@AGENTS.md' },
  {
    detail: 'Current desktop folder',
    kind: 'file',
    label: 'apps/desktop',
    source: '@apps/desktop',
  },
  {
    detail: 'Frequently used skill',
    kind: 'skill',
    label: 'frontend design',
    source: '@$frontend-design',
  },
  {
    detail: 'Managed Claude permission plugin',
    kind: 'plugin',
    label: 'Argo Session plugin',
    source: '@argo-plugin',
    cli: ['claude'],
  },
] as const satisfies readonly SessionReference[]

const escapedSources = sessionReferences.map((reference) =>
  reference.source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
)
const sourcePattern = new RegExp(`(^|\\s)(${escapedSources.join('|')})(?=\\s|$)`, 'g')

// A slash command is a skill invoked by name, so both wear the wand rather than a keyboard glyph.
const referenceIcons: Record<SessionReferenceKind, LucideIcon> = {
  command: WandSparkles,
  file: FileText,
  plugin: Plug,
  skill: WandSparkles,
}

export function SessionReferenceIcon({ kind }: { kind: SessionReferenceKind }) {
  const Icon = referenceIcons[kind]
  return <Icon aria-hidden="true" className="size-3.5" />
}

function renderReferenceIcon(unsupported: boolean, reference: SessionReference | undefined) {
  if (unsupported) return <TriangleAlert aria-hidden="true" className="size-3.5" />
  if (reference) return <SessionReferenceIcon kind={reference.kind} />
  return null
}

export function referenceBySource(source: string) {
  return sessionReferences.find((reference) => reference.source === source)
}

export function referenceSupportsCli(reference: SessionReference, cli: SessionCli | null) {
  return cli === null || reference.cli === undefined || reference.cli.includes(cli)
}

export function cliLabel(cli: SessionCli | null) {
  return cli ? HARNESSES[cli].label : 'this CLI'
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

export function SessionReferenceBadge({
  cli = null,
  source,
}: {
  cli?: SessionCli | null
  source: string
}) {
  const reference = referenceBySource(source)
  const unsupported = reference !== undefined && !referenceSupportsCli(reference, cli)
  return (
    <span className={unsupported ? 'mx-0.5 opacity-60' : 'mx-0.5'}>
      <InlineContext icon={renderReferenceIcon(unsupported, reference)} text={source} />
      {unsupported ? <span className="sr-only"> — not available for {cliLabel(cli)}</span> : null}
    </span>
  )
}

export function SessionReferenceText({
  cli = null,
  text,
}: {
  cli?: SessionCli | null
  text: string
}) {
  const fragments: ReactNode[] = []
  let cursor = 0
  let match = referenceInText(text)
  while (match !== null) {
    if (cursor < match.start) fragments.push(text.slice(cursor, match.start))
    fragments.push(
      <SessionReferenceBadge
        cli={cli}
        key={`${match.start}:${match.source}`}
        source={match.source}
      />,
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
