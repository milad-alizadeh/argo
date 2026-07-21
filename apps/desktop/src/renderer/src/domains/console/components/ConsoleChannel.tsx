import { Fragment } from 'react'
import { cn } from '@/lib/utils'
import { Text } from '@/shared/components/ui'
import { FEED_MARKER, LIVE_CHANNEL_LABEL } from './consoleChannels'
import { feedLines } from './feedLines'

export type ConsoleChannelProps = {
  /** DOM id, so the tab that opens this channel can point at it. */
  id?: string
  /** The rendered panel, so the Console can pull focus onto a capture it just opened. */
  ref?: React.Ref<HTMLElement>
  /** The raw feed, newline-separated. Rendered as text — never as markup. */
  feed: string
  className?: string
}

// The feed is ONE string the user reads, so one `Text` renders it and the marker spans only
// re-tint inside it. The marker is captured text, not an icon. Keys are the character
// offset each line starts at: a real position, stable under a growing feed.
function feedNodes(feed: string): React.ReactNode {
  let offset = 0
  return feedLines(feed).map((line, index) => {
    const key = offset
    offset += line.text.length + 1
    return (
      <Fragment key={key}>
        {index > 0 && '\n'}
        {line.marker && (
          <Text variant="code" as="span" className="text-tone-run">
            {`${FEED_MARKER} `}
          </Text>
        )}
        {line.text}
      </Fragment>
    )
  })
}

// Molecule: a captured tool or agent feed — R13's single capture slot. A frozen feed with no
// caret and no typing, told how to get back. (The live channel is a REAL terminal —
// `LiveTerminal` — not this; captures are text.)
export function ConsoleChannel({
  id,
  ref,
  feed,
  className,
}: ConsoleChannelProps): React.JSX.Element {
  return (
    <Text
      as="div"
      variant="code"
      id={id}
      ref={ref}
      role="tabpanel"
      aria-label="captured feed"
      tabIndex={0}
      className={cn(
        'min-h-0 overflow-auto whitespace-pre-wrap bg-background px-inset py-gap text-foreground-soft outline-none',
        className,
      )}
    >
      {feedNodes(feed)}
      <Text variant="code" as="div" className="text-foreground-faint">
        captured feed —{' '}
        <Text variant="code" as="span" className="text-foreground">
          esc
        </Text>{' '}
        returns to {LIVE_CHANNEL_LABEL}
      </Text>
    </Text>
  )
}
