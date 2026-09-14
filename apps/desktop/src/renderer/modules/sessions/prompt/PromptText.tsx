// Renders a stored prompt's skill mentions and links inline (#2049), shared by the Feed, the
// Roster and the composer (SkillMentionNode.tsx decorates with the same SkillBadge).
import { Sparkles } from 'lucide-react'
import { Fragment } from 'react'
import { Badge } from '@/renderer/components/ui/badge'
import { formatSkillLabel, type PromptSegment, parsePromptText } from './promptSegments'

export function SkillBadge({ name }: { name: string }) {
  return (
    <Badge variant="secondary" className="type-meta">
      <Sparkles data-icon="inline-start" />
      {formatSkillLabel(name)}
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

function renderSegment(segment: PromptSegment, key: string, interactiveLinks: boolean) {
  switch (segment.kind) {
    case 'skill':
      return <SkillBadge key={key} name={segment.name} />
    case 'link':
      return interactiveLinks ? (
        <PromptLink href={segment.href} key={key} label={segment.label} />
      ) : (
        <Fragment key={key}>{segment.label}</Fragment>
      )
    case 'text':
      return <Fragment key={key}>{segment.value}</Fragment>
  }
}

// `interactiveLinks` draws a link as an `<a>`. The Roster's title sits inside the row's own
// button, and a nested `<a>` there would be an interactive control inside another one, so it
// passes false and keeps the link text as plain text.
export function PromptText({
  text,
  interactiveLinks = true,
}: {
  text: string
  interactiveLinks?: boolean
}) {
  const seen = new Map<string, number>()
  return parsePromptText(text).map((segment) => {
    const identity = segmentIdentity(segment)
    const occurrence = seen.get(identity) ?? 0
    seen.set(identity, occurrence + 1)
    return renderSegment(segment, `${identity}:${occurrence}`, interactiveLinks)
  })
}
