import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { feedRows } from '../../shared'
import { parseTranscript } from './claudeTranscript'
import { type ImageReader, NO_IMAGE_READER } from './mediaResult'

// The seam: a real transcript's image reads → media results on the tree → media rows in the feed.
// The fixture is the shape Claude Code actually writes for a `Read` of a PNG, twice over the SAME
// path, which is the case the whole feature turns on.

const transcript = (): string[] =>
  readFileSync(join(__dirname, '__fixtures__', 'media.jsonl'), 'utf8').split('\n')

const parse = (readImage: ImageReader = NO_IMAGE_READER) =>
  parseTranscript('media', transcript(), { readImage })

const agentOf = (parsed: ReturnType<typeof parse>) => ({
  id: 'root',
  parentId: null,
  turns: parsed.tree.turns,
  compactions: parsed.tree.compactions,
  startedAtMs: null,
  endedAtMs: null,
  usage: null,
})

describe('images read from a real transcript', () => {
  it('keeps each read of one path on its own bytes', () => {
    const [turn] = parse().tree.turns

    expect(turn?.toolCalls.map((call) => [call.id, call.result?.kind])).toEqual([
      ['shot-1', 'media'],
      ['shot-2', 'media'],
      ['code-1', undefined],
      ['shot-3', 'output'],
      ['vector-1', undefined],
    ])
  })

  // Two reads of `/tmp/header.png` seconds apart, and the paragraph beneath them is about the
  // DIFFERENCE — so the two rows must not be the same picture twice.
  it('renders two reads of one path as two independent rows', () => {
    const media = feedRows(agentOf(parse())).filter((row) => row.kind === 'media')

    expect(media.map((row) => [row.subject, row.media.bytes])).toEqual([
      ['/tmp/header.png', 'BEFORE-BYTES'],
      ['/tmp/header.png', 'AFTER-BYTES'],
    ])
  })

  // Two pictures, then the reads that are NOT pictures: a source file folded quiet, and the failed
  // `.png` loud as the failure it is. The vector read is the trap — Claude Code hands an `.svg` back as
  // SOURCE, so a fallback gated on the extension alone would render it as a picture of the file now and
  // pull a real text row out of the fold.
  it('sorts the non-picture reads by what they actually returned', () => {
    const rows = feedRows(agentOf(parse(() => 'FROM-DISK')))

    expect(rows.map((row) => row.kind)).toEqual([
      'prompt',
      'media',
      'media',
      'quiet',
      'call',
      'quiet',
      'message',
    ])
  })

  // A failed read has an error message worth showing; a picture of the file as it stands now does not
  // explain the failure, so the disk is not consulted for one.
  it.each(['/tmp/gone.png', 'src/logo.svg'])('never re-reads the file behind %s', (path) => {
    const readImage = vi.fn(() => 'FROM-DISK')

    parse(readImage)

    expect(readImage).not.toHaveBeenCalledWith(path)
  })

  // The disk is never opened for a read the record already answered with bytes: the embedded block
  // cannot be invalidated by a later edit to the file, and that is the whole ordering.
  it('never reads a file whose bytes the record already carried', () => {
    const readImage = vi.fn(() => 'FROM-DISK')

    parse(readImage)

    expect(readImage).not.toHaveBeenCalled()
  })

  // A `.tsx` is not an image, so the fallback must not open it either — otherwise every source file
  // a session read would come back as a picture of nothing.
  it('never reads a path whose name says it is not an image', () => {
    const readImage = vi.fn(() => 'FROM-DISK')

    parse(readImage)

    expect(readImage).not.toHaveBeenCalledWith('src/Header.tsx')
  })
})
