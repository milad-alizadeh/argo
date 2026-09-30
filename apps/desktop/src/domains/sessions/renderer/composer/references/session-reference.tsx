import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { ComposerCommand } from '@/domains/sessions/api/composer-commands'
import { HARNESS_PRESENTATIONS, harnessLabel } from '@/harnesses/presentation-registry'
import { Icon, type IconName } from '@/platform/renderer/components/icon/icon'
import type { SessionHarness } from '../../harness/harnesses'
import { useHarnessCommands } from './composer-command-registry'
import { InlineContext } from './inline-context'

export type SessionReferenceKind = 'command' | 'file' | 'plugin' | 'skill'

export type SessionReference = {
  detail: string
  kind: SessionReferenceKind
  label: string
  source: string
  argumentHint?: string
  aliases?: readonly string[]
  // Every Harness supports a reference unless it needs the live Argo permission plugin.
  needsPermissionPlugin?: boolean
}

export function referencesFromCommands(commands: readonly ComposerCommand[]): SessionReference[] {
  return commands.map((command) => ({
    detail: command.description,
    kind: 'command',
    label: command.name,
    source: `/${command.name}`,
    argumentHint: command.argumentHint,
    aliases: command.aliases,
  }))
}

function escapeSource(source: string) {
  return source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function referencePattern(references: readonly SessionReference[]) {
  const sources = references.flatMap((reference) => [
    reference.source,
    ...(reference.aliases ?? []).map((alias) => `/${alias}`),
  ])
  if (sources.length === 0) return /(?!)/g
  return new RegExp(`(^|\\s)(${sources.map(escapeSource).join('|')})(?=\\s|$)`, 'g')
}

let remembered: readonly SessionReference[] = []

export function rememberComposerReferences(references: readonly SessionReference[]) {
  remembered = references
}

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

export function referenceBySource(
  source: string,
  references: readonly SessionReference[] = remembered,
) {
  return references.find(
    (reference) =>
      reference.source === source ||
      reference.aliases?.some((alias) => `/${alias}` === source) === true,
  )
}

export function referenceSupportsHarness(
  reference: SessionReference,
  harness: SessionHarness | null,
) {
  return (
    harness === null ||
    reference.needsPermissionPlugin !== true ||
    HARNESS_PRESENTATIONS[harness].permissionPlugin
  )
}

export function referenceHarnessLabel(harness: SessionHarness | null) {
  return harness ? harnessLabel(harness) : 'this Harness'
}

export function referenceInText(
  text: string,
  references: readonly SessionReference[] = remembered,
) {
  const match = referencePattern(references).exec(text)
  if (match === null || match.index === undefined) return null
  const source = match[2]
  if (source === undefined) return null
  return {
    end: match.index + match[0].length,
    source,
    start: match.index + (match[1]?.length ?? 0),
  }
}

function SessionReferenceBadge({
  harness = null,
  references,
  source,
}: {
  harness?: SessionHarness | null
  references: readonly SessionReference[]
  source: string
}) {
  const { t } = useTranslation('sessions')
  const reference = referenceBySource(source, references)
  const unsupported = reference !== undefined && !referenceSupportsHarness(reference, harness)
  return (
    <span className={unsupported ? 'mx-0.5 opacity-60' : 'mx-0.5'}>
      <InlineContext icon={renderReferenceIcon(unsupported, reference)} text={source} />
      {unsupported ? (
        <span className="sr-only">
          {t('composer.references.badgeUnavailable', { harness: referenceHarnessLabel(harness) })}
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
  const commands = useHarnessCommands(harness)
  const references = referencesFromCommands(commands)
  const fragments: ReactNode[] = []
  let cursor = 0
  let match = referenceInText(text, references)
  while (match !== null) {
    if (cursor < match.start) fragments.push(text.slice(cursor, match.start))
    fragments.push(
      <SessionReferenceBadge
        harness={harness}
        key={`${match.start}:${match.source}`}
        references={references}
        source={match.source}
      />,
    )
    cursor = match.end
    match = referenceInText(text.slice(cursor), references)
    if (match !== null) match = { ...match, end: match.end + cursor, start: match.start + cursor }
  }
  if (cursor < text.length) fragments.push(text.slice(cursor))
  return fragments
}

export function referenceSuggestions(references: readonly SessionReference[], query: string) {
  const loweredQuery = query.toLowerCase()
  return references.filter((reference) =>
    [
      reference.label,
      reference.detail,
      reference.source,
      reference.argumentHint ?? '',
      ...(reference.aliases ?? []),
    ]
      .join(' ')
      .toLowerCase()
      .includes(loweredQuery),
  )
}
