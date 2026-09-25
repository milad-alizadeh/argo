// An image a prompt carries reaches the Feed as a URL the renderer's CSP `img-src` already
// allows: inline bytes as `data:`, a file on disk as `argo-attachment://`.
import { z } from 'zod'
import { ATTACHMENT_HOST, ATTACHMENT_SCHEME } from '@/domains/sessions/api/attachment-url'
import { attachmentKindOf } from '@/domains/sessions/api/attachments'
import type { ContentBlock } from '../source/transcript-content'

// Never `file://`: Chromium refuses a `file://` subresource load from a document the Vite dev
// server serves over `http://`, which left every locally-attached image thumbnail unrendered in
// a dev build (#2249). A registered privileged scheme survives both the dev server and the
// packaged app, and `main.ts` is the only other reader of this constant, to register and serve
// it. The `local` segment is a fixed placeholder host: a `standard` scheme with no host collapses
// an empty one into the path's first segment, so the absolute path always starts one segment in.
const MEDIA_TYPE = String.raw`image\/[\w.+-]+`
const DATA_URL = new RegExp(`^data:${MEDIA_TYPE};base64,`)
const IMAGE_URL = new RegExp(`${DATA_URL.source}|^${ATTACHMENT_SCHEME}://${ATTACHMENT_HOST}/`)

export const feedImageUrlSchema = z.string().regex(IMAGE_URL)

// Only the builders below make one, so an image block never holds a Harness's own string.
const builtImageUrlSchema = feedImageUrlSchema.brand<'FeedImageUrl'>()
export type FeedImageUrl = z.infer<typeof builtImageUrlSchema>

function built(url: string): FeedImageUrl | null {
  const parsed = builtImageUrlSchema.safeParse(url)
  return parsed.success ? parsed.data : null
}

export function dataImageUrl(mediaType: string, data: string): FeedImageUrl | null {
  return checkedDataImageUrl(`data:${mediaType};base64,${data}`)
}

// A data URL a Harness wrote whole, kept only when it holds an image.
export function checkedDataImageUrl(url: string): FeedImageUrl | null {
  return DATA_URL.test(url) ? built(url) : null
}

// POSIX only: the managed drivers these paths come from run on macOS today (#1894, #1892 track
// Linux and Windows separately).
export function fileImageUrl(path: string): FeedImageUrl | null {
  return path.startsWith('/')
    ? built(
        `${ATTACHMENT_SCHEME}://${ATTACHMENT_HOST}${path
          .split('/')
          .map(encodeURIComponent)
          .join('/')}`,
      )
    : null
}

// An attached file's picture, when its name says it is one.
export function attachedImageUrl(path: string): FeedImageUrl | null {
  return attachmentKindOf(path) === 'image' ? fileImageUrl(path) : null
}

export function imageBlocks(urls: readonly (FeedImageUrl | null)[]): ContentBlock[] {
  return urls.flatMap((url): ContentBlock[] => (url === null ? [] : [{ shape: 'image', url }]))
}
