import { SPY_ATTRIBUTE } from './useScrollSpy'

/**
 * Atom: one row inside a feed section that the navigation list can jump to and the scroll-spy can name.
 *
 * A wrapper rather than an attribute the caller spells itself: the anchor attribute has ONE spelling in
 * this module, and a row that wore its own copy of it is the drift the spy cannot detect.
 */
export function FeedAnchor({
  anchor,
  children,
}: {
  anchor: string
  children: React.ReactNode
}): React.JSX.Element {
  return <div {...{ [SPY_ATTRIBUTE]: anchor }}>{children}</div>
}
