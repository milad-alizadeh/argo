// An image a prompt carries reaches the Feed as a URL the renderer's CSP `img-src` already
// allows: inline bytes as `data:`, a file on disk as `file://`. Every adapter builds it here so
// the row schema can refuse anything else.
import { z } from 'zod'

const MEDIA_TYPE = String.raw`image\/[\w.+-]+`
const DATA_URL = new RegExp(`^data:${MEDIA_TYPE};base64,`)
const IMAGE_URL = new RegExp(`${DATA_URL.source}|^file:///`)

export const feedImageUrlSchema = z.string().regex(IMAGE_URL)

export function dataImageUrl(mediaType: string, data: string): string | null {
  return checkedDataImageUrl(`data:${mediaType};base64,${data}`)
}

// A data URL a CLI wrote whole, kept only when it holds an image.
export function checkedDataImageUrl(url: string): string | null {
  return DATA_URL.test(url) ? url : null
}

// POSIX only: the managed drivers these paths come from run on macOS today (#1894, #1892 track
// Linux and Windows separately).
export function fileImageUrl(path: string): string | null {
  return path.startsWith('/') ? `file://${path.split('/').map(encodeURIComponent).join('/')}` : null
}
