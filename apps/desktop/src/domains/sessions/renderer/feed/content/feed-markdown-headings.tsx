import type { ReactNode } from 'react'
import type { Components } from 'react-markdown'

const HEADING_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const

// The wrapper carries `type-prose`: on the heading itself its doubled selector drops the weight.
const HEADING_CLASS = 'mb-2 font-medium'

// Markdown arrives at whatever level the author picked (`#` through `######`), but the DOM
// heading it lands in has to continue the surrounding screen's own outline, not restart one.
// `offset` is that screen's own last heading depth: the Session feed sits two levels under its
// screen's `h1`/`h2`, and a Ticket's body sits one level under the Ticket's own `h2`.
function clampedHeadingTag(markdownLevel: number, offset: number): HeadingTag {
  switch (Math.min(markdownLevel + offset - 1, HEADING_TAGS.length - 1)) {
    case 0:
      return 'h1'
    case 1:
      return 'h2'
    case 2:
      return 'h3'
    case 3:
      return 'h4'
    case 4:
      return 'h5'
    default:
      return 'h6'
  }
}

function headingComponent(markdownLevel: number, offset: number) {
  const Heading = clampedHeadingTag(markdownLevel, offset)
  return ({ children }: { children?: ReactNode }) => (
    <Heading className={HEADING_CLASS}>{children}</Heading>
  )
}

export function headingComponents(offset: number): Pick<Components, (typeof HEADING_TAGS)[number]> {
  return {
    h1: headingComponent(1, offset),
    h2: headingComponent(2, offset),
    h3: headingComponent(3, offset),
    h4: headingComponent(4, offset),
    h5: headingComponent(5, offset),
    h6: headingComponent(6, offset),
  }
}

export type HeadingTag = (typeof HEADING_TAGS)[number]
