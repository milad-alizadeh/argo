import { Text } from '@/shared/components/ui'

/**
 * Atom: the one line the Concierge is currently saying.
 *
 * Silence is the default and it renders nothing at all — an empty box held open for a caption
 * that is not there would read as a broken bar. Width-capped and truncated so a long line cannot
 * push the bar's right cluster off its own edge.
 */
export function ConciergeCaption({
  caption,
}: {
  /** What the Concierge is saying, or `null` when it is silent. */
  caption: string | null
}): React.JSX.Element | null {
  if (caption === null) return null
  return (
    <Text
      variant="title"
      data-component="ConciergeCaption"
      className="max-w-md truncate text-foreground-soft"
    >
      {caption}
    </Text>
  )
}
