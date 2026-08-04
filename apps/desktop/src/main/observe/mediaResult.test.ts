import { describe, expect, it, vi } from 'vitest'
import { type ImageReader, mediaResultFrom, NO_IMAGE_READER } from './mediaResult'

// The source-preference order, judged directly: which of the two places an image can be read from
// wins, and what a row is told when neither has anything. No filesystem and no DOM — the disk half
// is a port, which is why it can be a spy.

/** The host's own result object, as Claude Code writes it beside a `Read` of an image. */
const toolUseResult = (over: Record<string, unknown> = {}): unknown => ({
  type: 'image',
  file: { base64: 'EMBEDDED', type: 'image/png', ...over },
})

/** The content block the agent was actually sent — the same image in the API's own shape. */
const imagePart = (over: Record<string, unknown> = {}): unknown => [
  { type: 'image', source: { type: 'base64', data: 'IN-PART', media_type: 'image/jpeg', ...over } },
]

const read = (over: Partial<Parameters<typeof mediaResultFrom>[0]> = {}) => ({
  toolUseResult: null,
  content: null,
  path: null,
  ...over,
})

const onDisk: ImageReader = () => 'FROM-DISK'

describe('the image a call showed', () => {
  it('prefers the record’s own embedded bytes over the file on disk', () => {
    const readImage = vi.fn(onDisk)

    const media = mediaResultFrom(
      read({ toolUseResult: toolUseResult(), path: 'tmp/shot.png' }),
      readImage,
    )

    expect(media).toEqual({
      kind: 'media',
      tier: 'direct',
      mediaType: 'image/png',
      bytes: 'EMBEDDED',
    })
    // Not merely outranked — never opened. The point of the order is that the disk cannot invalidate
    // what the agent saw, and a read that happens anyway is a read that can start costing.
    expect(readImage).not.toHaveBeenCalled()
  })

  it('reads the content block where the host wrote no result object', () => {
    const media = mediaResultFrom(read({ content: imagePart() }), NO_IMAGE_READER)

    expect(media).toEqual({
      kind: 'media',
      tier: 'direct',
      mediaType: 'image/jpeg',
      bytes: 'IN-PART',
    })
  })

  // The fallback, and its tier: the same filename is not the same picture, so it can only ever be
  // rendered at the lower tier with the row saying so.
  it('falls back to the file on disk at the lower tier', () => {
    const media = mediaResultFrom(read({ path: '/tmp/Shot.PNG' }), onDisk)

    expect(media).toEqual({
      kind: 'media',
      tier: 'derived',
      mediaType: 'image/png',
      bytes: 'FROM-DISK',
    })
  })

  it('reports a path that names an image and yields no bytes as a row with none', () => {
    const media = mediaResultFrom(read({ path: 'tmp/gone.png' }), NO_IMAGE_READER)

    expect(media).toMatchObject({ tier: 'derived', bytes: null })
  })

  // Whitespace is not an image, and an empty `src` handed to the browser is the broken glyph this
  // exists to prevent.
  it('reports an embedded block with no readable bytes as a row with none', () => {
    const media = mediaResultFrom(read({ toolUseResult: toolUseResult({ base64: '  ' }) }), onDisk)

    expect(media).toMatchObject({ tier: 'direct', bytes: null })
  })
})

describe('what is not an image', () => {
  // Gated on the media TYPE, never on the tool's name.
  const NOT_IMAGES: readonly [string, ReturnType<typeof read>][] = [
    ['a text result', read({ content: [{ type: 'text', text: 'hello' }] })],
    ['a plain string result', read({ content: 'hello' })],
    [
      'a non-image binary the host still called a file',
      read({ toolUseResult: toolUseResult({ type: 'application/pdf' }) }),
    ],
    ['a result object of another type', read({ toolUseResult: { type: 'text', file: {} } })],
    ['a path with no image extension', read({ path: 'src/token.ts' })],
    ['a path with no extension at all', read({ path: 'Makefile' })],
    ['a call that named no path', read()],
  ]

  it.each(NOT_IMAGES)('reads nothing from %s', (_name, input) => {
    expect(mediaResultFrom(input, onDisk)).toBeNull()
  })

  // A model wrote the record, so nothing is trusted to have the shape it should.
  it.each([[null], [42], ['string'], [{ type: 'image' }], [{ type: 'image', file: 7 }]])(
    'reads nothing from the malformed result %s',
    (raw) => {
      expect(mediaResultFrom(read({ toolUseResult: raw }), NO_IMAGE_READER)).toBeNull()
    },
  )
})
