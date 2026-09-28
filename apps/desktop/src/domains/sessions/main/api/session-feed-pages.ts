import { z } from 'zod'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import { identifierSchema } from '@/shared/validation'

export const FEED_PAGE_ITEM_LIMIT = 50
export const FEED_PAGE_BYTE_LIMIT = 256 * 1024
const CACHE_BYTE_LIMIT = 16 * 1024 * 1024

const cursorSchema = z.strictObject({
  version: z.literal(1),
  sessionId: identifierSchema,
  chainId: identifierSchema,
  firstIndex: z.number().int().nonnegative(),
  firstItemId: identifierSchema,
})

type Cursor = z.infer<typeof cursorSchema>
type CachedHistory = { content: FeedContent[]; bytes: number }

function itemBytes(item: FeedContent): number {
  return Buffer.byteLength(JSON.stringify(item), 'utf8')
}

function pageBefore(content: readonly FeedContent[], end: number): FeedContent[] {
  const page: FeedContent[] = []
  let bytes = 0
  for (let index = end - 1; index >= 0 && page.length < FEED_PAGE_ITEM_LIMIT; index -= 1) {
    const item = content[index]
    if (item === undefined) break
    const size = itemBytes(item)
    if (page.length > 0 && bytes + size > FEED_PAGE_BYTE_LIMIT) break
    page.unshift(item)
    bytes += size
  }
  return page
}

function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url')
}

function decodeCursor(value: string): Cursor | null {
  try {
    return cursorSchema.parse(JSON.parse(Buffer.from(value, 'base64url').toString('utf8')))
  } catch {
    return null
  }
}

export class SessionFeedPages {
  private readonly cache = new Map<string, CachedHistory>()
  private usedBytes = 0

  private key(sessionId: string, chainId: string) {
    return `${sessionId}:${chainId}`
  }

  private remember(sessionId: string, chainId: string, content: FeedContent[]) {
    const key = this.key(sessionId, chainId)
    const prior = this.cache.get(key)
    if (prior !== undefined) this.usedBytes -= prior.bytes
    this.cache.delete(key)
    const bytes = Buffer.byteLength(JSON.stringify(content), 'utf8')
    if (bytes > CACHE_BYTE_LIMIT) return
    this.cache.set(key, { content, bytes })
    this.usedBytes += bytes
    while (this.usedBytes > CACHE_BYTE_LIMIT) {
      const oldest = this.cache.keys().next().value
      if (oldest === undefined) break
      const removed = this.cache.get(oldest)
      if (removed !== undefined) this.usedBytes -= removed.bytes
      this.cache.delete(oldest)
    }
  }

  async read(options: {
    sessionId: string
    chainId: string
    before: string | null
    readHistory: () => Promise<FeedContent[]>
  }): Promise<{ content: FeedContent[]; olderCursor: string | null }> {
    const { sessionId, chainId, before, readHistory } = options
    const cursor = before === null ? null : decodeCursor(before)
    if (
      before !== null &&
      (cursor === null || cursor.sessionId !== sessionId || cursor.chainId !== chainId)
    )
      throw new Error('invalid-feed-cursor')
    const key = this.key(sessionId, chainId)
    const content =
      before === null
        ? await readHistory()
        : (this.cache.get(key)?.content ?? (await readHistory()))
    if (before === null || !this.cache.has(key)) this.remember(sessionId, chainId, content)
    let end = content.length
    if (cursor !== null) {
      end =
        content[cursor.firstIndex]?.id === cursor.firstItemId
          ? cursor.firstIndex
          : content.findIndex((item) => item.id === cursor.firstItemId)
    }
    if (end < 0) throw new Error('expired-feed-cursor')
    const page = pageBefore(content, end)
    const first = page[0]
    const olderCursor =
      first === undefined || end === page.length
        ? null
        : encodeCursor({
            version: 1,
            sessionId,
            chainId,
            firstIndex: end - page.length,
            firstItemId: first.id,
          })
    return { content: page, olderCursor }
  }
}
