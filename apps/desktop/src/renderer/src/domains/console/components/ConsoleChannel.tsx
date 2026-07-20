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
  className?: string
} & (
  | {
      /** The session's own channel: the tail of its output, its prompt, and the caret. */
      kind: 'live'
      /** The prompt line, tinted — `auth refactor $`. */
      prompt: string
      /** The output above the prompt. Empty on a session that has said nothing yet. */
      tail: string
    }
  | {
      /** A captured tool or agent feed: text only, no caret, and told how to get back. */
      kind: 'capture'
      /** The raw feed, newline-separated. Rendered as text — never as markup. */
      feed: string
    }
)

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

// Molecule: the ONE monospace surface's body (R13). The caret is what separates the two
// variants — live carries prompt, caret and tail; a capture is a frozen feed.
// A real xterm pane here MUST import `@xterm/xterm/css/xterm.css` or it renders ghost rows.
export function ConsoleChannel(props: ConsoleChannelProps): React.JSX.Element {
  const shell = cn(
    'min-h-0 overflow-auto whitespace-pre-wrap bg-background px-inset py-gap text-foreground-soft outline-none',
    props.className,
  )

  switch (props.kind) {
    case 'live':
      return (
        <Text
          as="div"
          variant="code"
          id={props.id}
          ref={props.ref}
          role="tabpanel"
          aria-label={LIVE_CHANNEL_LABEL}
          tabIndex={0}
          // The live channel takes typing, which is what makes it the session's own
          // surface rather than a transcript of it.
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          className={shell}
        >
          {props.tail !== '' && (
            <>
              {feedNodes(props.tail)}
              {'\n'}
            </>
          )}
          <Text variant="code" as="span" className="text-tone-run">
            {props.prompt}
          </Text>{' '}
          <span aria-hidden className="caret-cell" />
        </Text>
      )
    case 'capture':
      return (
        <Text
          as="div"
          variant="code"
          id={props.id}
          ref={props.ref}
          role="tabpanel"
          aria-label="captured feed"
          tabIndex={0}
          className={shell}
        >
          {feedNodes(props.feed)}
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
}
