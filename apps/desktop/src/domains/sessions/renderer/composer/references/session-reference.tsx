import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { InlineContext } from '@/domains/sessions/renderer/composer/references/inline-context'
import { HARNESSES, type SessionHarness } from '@/domains/sessions/renderer/harness/harnesses'
import { Icon, type IconName } from '@/platform/renderer/components/icon'

export type SessionReferenceKind = 'command' | 'file' | 'plugin' | 'skill'

export type SessionReference = {
  detail: string
  kind: SessionReferenceKind
  label: string
  source: string
  // Every Harness supports a reference unless this names the closed set that does; a plugin invoking
  // Claude's own permission system has no Codex equivalent to name.
  harness?: readonly SessionHarness[]
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
    harness: ['claude'],
  },
] as const satisfies readonly SessionReference[]

const escapedSources = sessionReferences.map((reference) =>
  reference.source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
)
const sourcePattern = new RegExp(`(^|\\s)(${escapedSources.join('|')})(?=\\s|$)`, 'g')

// A slash command is a skill invoked by name, so both wear the wand rather than a keyboard glyph.
const referenceIcons: Record<SessionReferenceKind, IconName> = {
  command: 'skill-invocation',
  file: 'file-text',
  plugin: 'connect',
  skill: 'skill-invocation',
}

export function SessionReferenceIcon({ kind }: { kind: SessionReferenceKind }) {
  return <Icon name={referenceIcons[kind]} className="size-3.5" />
}

function renderReferenceIcon(unsupported: boolean, reference: SessionReference | undefined) {
  if (unsupported) return <Icon name="triangle-alert" className="size-3.5" />
  if (reference) return <SessionReferenceIcon kind={reference.kind} />
  return null
}

export function referenceBySource(source: string) {
  return sessionReferences.find((reference) => reference.source === source)
}

export function referenceSupportsHarness(
  reference: SessionReference,
  harness: SessionHarness | null,
) {
  return harness === null || reference.harness === undefined || reference.harness.includes(harness)
}

export function harnessLabel(harness: SessionHarness | null) {
  return harness ? HARNESSES[harness].label : 'this Harness'
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
  harness = null,
  source,
}: {
  harness?: SessionHarness | null
  source: string
}) {
  const { t } = useTranslation('sessions')
  const reference = referenceBySource(source)
  const unsupported = reference !== undefined && !referenceSupportsHarness(reference, harness)
  return (
    <span className={unsupported ? 'mx-0.5 opacity-60' : 'mx-0.5'}>
      <InlineContext icon={renderReferenceIcon(unsupported, reference)} text={source} />
      {unsupported ? (
        <span className="sr-only">
          {t('composer.references.badgeUnavailable', { harness: harnessLabel(harness) })}
        </span>
      ) : null}
    </span>
  )
}

export function SessionReferenceText({
  harness = null,
  text,
}: {
  harness?: SessionHarness | null
  text: string
}) {
  const fragments: ReactNode[] = []
  let cursor = 0
  let match = referenceInText(text)
  while (match !== null) {
    if (cursor < match.start) fragments.push(text.slice(cursor, match.start))
    fragments.push(
      <SessionReferenceBadge
        harness={harness}
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
