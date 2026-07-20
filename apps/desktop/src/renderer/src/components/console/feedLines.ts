import { FEED_MARKER, type FeedLine } from './consoleChannels'

/** Split a feed into lines, lifting the leading marker off each one. Blank lines survive
 * as empty text so the feed's own spacing is preserved. */
export function feedLines(feed: string): FeedLine[] {
  const prefix = `${FEED_MARKER} `
  return feed.split('\n').map((line) => {
    const marker = line.startsWith(prefix)
    return { marker, text: marker ? line.slice(prefix.length) : line }
  })
}
