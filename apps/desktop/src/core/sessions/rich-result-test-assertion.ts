import assert from 'node:assert/strict'
import type { RichResultBlock } from './transcript'

export function assertRichResult(blocks: RichResultBlock[] | undefined): void {
  assert.deepEqual(blocks, [
    { shape: 'text', text: 'before' },
    { shape: 'image', url: 'data:image/png;base64,AAAA' },
    { shape: 'text', text: 'after' },
  ])
}
