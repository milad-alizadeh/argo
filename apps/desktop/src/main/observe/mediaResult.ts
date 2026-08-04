import type { MediaResult } from '../../shared'
import { asArray, asString, isRecord } from './untrusted'

// A call's result → the image it SHOWED, by ONE fixed source order: the transcript's own embedded
// bytes first, the file on disk only where there are none.
//
// Embedded first because they are what the agent actually LOOKED AT, and because a record cannot be
// invalidated by a later edit to the file. Agents re-render the same screenshot path several times
// within one turn, so reading the path as the primary source would silently show the wrong pixels in
// exactly the debugging loop inline media exists to support — which is worse than showing nothing.

/** Reading one image file off disk, base64, or `null` where it cannot be read at all.
 *
 * A PORT rather than a direct `fs` call, so the source-preference order is falsifiable without a
 * filesystem — and so a tree parsed with no reader supplied simply has no fallback, rather than
 * a fabricated one. */
export type ImageReader = (path: string) => string | null

/** The default: no fallback. A parse that was given no reader reports only what the record carried,
 * which is the honest floor for every test and every caller that has no disk to read. */
export const NO_IMAGE_READER: ImageReader = () => null

/** What the record itself says about the call, in the two places an image can land. */
export interface MediaRead {
  /** The host's own result object (`toolUseResult`). */
  toolUseResult: unknown
  /** The `tool_result` part's content — the API-shaped blocks the agent was actually sent. */
  content: unknown
  /** The file the call named, where re-reading it would MEAN anything: `null` for a call whose
   * target is not a path (a grep pattern, a command line, a subagent's description), which is what
   * keeps the fallback from trying to open a regex. */
  path: string | null
}

const IMAGE_PREFIX = 'image/'

/** An image type the record declared, or `null` for anything else.
 *
 * Gated on the media TYPE and never on the tool's name: the screenshot an agent looks at may arrive
 * from a `Read`, a fetch, or an MCP browser tool, and none of those names says "these are pixels".
 * A non-image binary read declares no image type, so it produces no media at all. */
function imageType(raw: unknown): string | null {
  const type = asString(raw)
  return type?.startsWith(IMAGE_PREFIX) === true ? type : null
}

/** Bytes the agent itself was shown: DIRECT, and unable to go stale — they are IN the record. Base64
 * of whitespace is absent bytes rather than a zero-length image, so the row says it has nothing to
 * show instead of handing an empty `src` to the browser. */
function embedded(mediaType: string, base64: string | null): MediaResult {
  return {
    kind: 'media',
    tier: 'direct',
    mediaType,
    bytes: base64 === null || base64.trim() === '' ? null : base64,
  }
}

/** The host's own result object: `{ type: 'image', file: { base64, type } }`. */
function fromToolUseResult(raw: unknown): MediaResult | null {
  if (!isRecord(raw) || raw.type !== 'image' || !isRecord(raw.file)) return null
  const mediaType = imageType(raw.file.type)
  return mediaType === null ? null : embedded(mediaType, asString(raw.file.base64))
}

/** One content block as the agent was sent it: `{ type: 'image', source: { data, media_type } }`. */
function fromContentPart(part: unknown): MediaResult | null {
  if (!isRecord(part) || part.type !== 'image' || !isRecord(part.source)) return null
  const mediaType = imageType(part.source.media_type)
  return mediaType === null ? null : embedded(mediaType, asString(part.source.data))
}

/** The extensions worth reading from disk, with the type each one means. A table rather than a sniff
 * of the bytes, because the point of this path is to not open a file at all unless its name says it
 * is plausibly an image. */
const TYPE_BY_EXTENSION: Readonly<Record<string, string>> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
}

function extensionOf(path: string): string {
  const dot = path.lastIndexOf('.')
  return dot === -1 ? '' : path.slice(dot).toLowerCase()
}

/**
 * The file at that path NOW, at the LOWER tier. Only reached where the record embedded nothing.
 *
 * A path that names an image and yields no bytes is still a media result rather than nothing: the
 * agent DID look at a picture, and a row saying the picture can no longer be shown is honest where
 * a folded read line is merely silent about it.
 */
function fromDisk(path: string | null, readImage: ImageReader): MediaResult | null {
  if (path === null) return null
  const mediaType = TYPE_BY_EXTENSION[extensionOf(path)]
  if (mediaType === undefined) return null
  return { kind: 'media', tier: 'derived', mediaType, bytes: readImage(path) }
}

/** The image a call showed, or `null` where the call showed none — which is every call that is not
 * an image read, and is what keeps a non-image binary out of the feed's media rows. */
export function mediaResultFrom(read: MediaRead, readImage: ImageReader): MediaResult | null {
  const inRecord =
    fromToolUseResult(read.toolUseResult) ??
    asArray(read.content).reduce<MediaResult | null>(
      (found, part) => found ?? fromContentPart(part),
      null,
    )
  return inRecord ?? fromDisk(read.path, readImage)
}
