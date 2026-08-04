import { readFileSync, statSync } from 'node:fs'
import type { ImageReader } from './mediaResult'

// The ONE place the media fallback touches the filesystem. Kept apart from `mediaResult.ts` so the
// source-preference order there stays testable with a fake and never needs a temp directory.

/** The largest file worth re-reading. A bound rather than none, because this runs synchronously in
 * the middle of a transcript parse: a 60MB scan dropped in the working tree would stall the observer
 * and then sit in the projection, for a fallback whose whole premise is that it is second-best. */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024

/**
 * The file at that path now, base64, or `null` where it cannot be read.
 *
 * Every failure is one answer: missing, deleted, a directory, a permission error, or simply too
 * large all mean "no bytes to show", and the row above renders its placeholder rather than a broken
 * glyph. Nothing here throws — an unreadable image must never take a transcript parse down with it.
 */
export const readImageFile: ImageReader = (path) => {
  try {
    if (statSync(path).size > MAX_IMAGE_BYTES) return null
    return readFileSync(path).toString('base64')
  } catch {
    return null
  }
}
