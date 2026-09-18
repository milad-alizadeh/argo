// A stored prompt can carry a CLI's own markdown-link mention syntax, `[$skill](path)`, and plain
// or markdown-wrapped URLs. This turns that raw text into segments the Feed, Roster and the
// composer draw the same way (#2049): a skill badge, a clean link, or plain text.
import { isExternalLink } from '@/core/security/urls-contract'

// Shared with the composer's Lexical transformer (skill-mention-node.tsx), so the two recognisers
// never drift: two capture groups, the skill name and its path.
export const SKILL_MENTION_SOURCE = String.raw`\[\$([A-Za-z0-9][\w.-]*)\]\(([^\s()]+)\)`
const MARKDOWN_LINK_SOURCE = String.raw`\[([^\]]*)\]\(([^\s()]+)\)`
const BARE_URL_SOURCE = String.raw`https?:\/\/[^\s<>()[\]{}]+`

export type PromptSegment =
  | { kind: 'text'; value: string }
  | { kind: 'skill'; name: string; path: string }
  | { kind: 'link'; href: string; label: string }

// `name` is a slug (`frontend-design`); the badge shows the words it names (`Frontend Design`).
export function formatSkillLabel(name: string): string {
  return name
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

type MatchCandidate = { index: number; length: number; segment: PromptSegment }

function matchFrom(source: string, text: string, fromIndex: number): RegExpExecArray | null {
  const pattern = new RegExp(source, 'g')
  pattern.lastIndex = fromIndex
  return pattern.exec(text)
}

// A skill mention's own brackets also satisfy the generic markdown-link pattern at the same
// index, so candidates are pushed skill-first: a stable sort keeps that preference on a tie.
function candidatesFrom(text: string, fromIndex: number): MatchCandidate[] {
  const candidates: MatchCandidate[] = []

  const skillMatch = matchFrom(SKILL_MENTION_SOURCE, text, fromIndex)
  if (skillMatch) {
    candidates.push({
      index: skillMatch.index,
      length: skillMatch[0].length,
      segment: { kind: 'skill', name: skillMatch[1] ?? '', path: skillMatch[2] ?? '' },
    })
  }

  const linkMatch = matchFrom(MARKDOWN_LINK_SOURCE, text, fromIndex)
  if (linkMatch) {
    const href = linkMatch[2] ?? ''
    const label = linkMatch[1] || href
    candidates.push({
      index: linkMatch.index,
      length: linkMatch[0].length,
      // A link Argo cannot open (no http/https/mailto) keeps its label as plain text rather
      // than a dead click target.
      segment: isExternalLink(href)
        ? { kind: 'link', href, label }
        : { kind: 'text', value: label },
    })
  }

  const urlMatch = matchFrom(BARE_URL_SOURCE, text, fromIndex)
  if (urlMatch) {
    candidates.push({
      index: urlMatch.index,
      length: urlMatch[0].length,
      segment: { kind: 'link', href: urlMatch[0], label: urlMatch[0] },
    })
  }

  return candidates.sort((a, b) => a.index - b.index)
}

export function parsePromptText(text: string): PromptSegment[] {
  const segments: PromptSegment[] = []
  let cursor = 0

  while (cursor < text.length) {
    const [match] = candidatesFrom(text, cursor)
    if (!match) break
    if (match.index > cursor)
      segments.push({ kind: 'text', value: text.slice(cursor, match.index) })
    segments.push(match.segment)
    cursor = match.index + match.length
  }

  if (cursor < text.length) segments.push({ kind: 'text', value: text.slice(cursor) })
  return segments
}
