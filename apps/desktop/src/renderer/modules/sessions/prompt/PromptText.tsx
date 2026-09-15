// Renders a stored prompt's skill mentions and links inline (#2049), shared by the Feed, the
// Roster and the composer (SkillMentionNode.tsx decorates with the same SkillBadge).
import { Sparkles } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/renderer/components/ui/badge'
import { formatSkillLabel, type PromptSegment, parsePromptText } from './promptSegments'

// Set in its host's type role (the Feed prompt, a Roster title, the composer), so the name
// reads at the same size as the words beside it. Its baseline is the name's, not the icon's
// bottom edge, so the name sits on the same line as the surrounding text.
const SKILL_BADGE_CLASS =
  'items-baseline text-[length:inherit] leading-none [&>svg]:size-(--size-icon-text)! [&>svg]:self-center'

export type PromptSkill = { name: string; path: string }

export function SkillBadge({ name }: { name: string }) {
  return (
    <Badge variant="secondary" className={SKILL_BADGE_CLASS}>
      <Sparkles data-icon="inline-start" />
      {formatSkillLabel(name)}
    </Badge>
  )
}

// The same badge as a button, where a caller can open the skill (the Feed, into the inspector). The
// prompt bubble shares the badge's own ground, so an outline on the page ground marks it a control.
function SkillButton({
  skill,
  onOpen,
}: {
  skill: PromptSkill
  onOpen: (skill: PromptSkill) => void
}) {
  const { t } = useTranslation('sessions')
  const label = formatSkillLabel(skill.name)
  return (
    <Badge
      aria-label={t('skill.open', { name: label })}
      className={`${SKILL_BADGE_CLASS} bg-background hover:bg-background/60`}
      onClick={() => onOpen(skill)}
      render={<button type="button" />}
      variant="outline"
    >
      <Sparkles data-icon="inline-start" />
      {label}
    </Badge>
  )
}

function PromptLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="underline decoration-border underline-offset-4 hover:decoration-foreground"
    >
      {label}
    </a>
  )
}

// A segment's own content, used to build a React key stable across re-parses of the same
// prompt without repeating the mention's own markdown syntax here.
function segmentIdentity(segment: PromptSegment): string {
  switch (segment.kind) {
    case 'skill':
      return `skill:${segment.name}:${segment.path}`
    case 'link':
      return `link:${segment.href}`
    case 'text':
      return `text:${segment.value}`
  }
}

type RenderOptions = {
  interactiveLinks: boolean
  onOpenSkill: ((skill: PromptSkill) => void) | null
  renderText: (value: string) => ReactNode
}

function renderSegment(segment: PromptSegment, key: string, options: RenderOptions) {
  switch (segment.kind) {
    case 'skill':
      return options.onOpenSkill === null ? (
        <SkillBadge key={key} name={segment.name} />
      ) : (
        <SkillButton key={key} onOpen={options.onOpenSkill} skill={segment} />
      )
    case 'link':
      return options.interactiveLinks ? (
        <PromptLink href={segment.href} key={key} label={segment.label} />
      ) : (
        <Fragment key={key}>{segment.label}</Fragment>
      )
    case 'text':
      return <Fragment key={key}>{options.renderText(segment.value)}</Fragment>
  }
}

// `interactiveLinks` draws a link as an `<a>`. The Roster's title sits inside the row's own
// button, and a nested `<a>` there would be an interactive control inside another one, so it
// passes false and keeps the link text as plain text.
//
// `renderText` lets a caller further decorate a segment's plain-text leftovers, e.g. the
// Roster badging the composer's own bare reference tokens (`/implement`, `@AGENTS.md`) via
// `SessionReferenceText` (#2044) — a fixed-list token match unrelated to this module's dynamic
// markdown-mention parsing, so it stays out of `promptSegments` rather than merge with it.
export function PromptText({
  text,
  interactiveLinks = true,
  onOpenSkill = null,
  renderText = (value) => value,
}: {
  text: string
  interactiveLinks?: boolean
  onOpenSkill?: ((skill: PromptSkill) => void) | null
  renderText?: (value: string) => ReactNode
}) {
  const seen = new Map<string, number>()
  return parsePromptText(text).map((segment) => {
    const identity = segmentIdentity(segment)
    const occurrence = seen.get(identity) ?? 0
    seen.set(identity, occurrence + 1)
    return renderSegment(segment, `${identity}:${occurrence}`, {
      interactiveLinks,
      onOpenSkill,
      renderText,
    })
  })
}
