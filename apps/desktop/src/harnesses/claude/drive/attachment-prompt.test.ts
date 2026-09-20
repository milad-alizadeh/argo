import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  embedAttachments,
  mentionableAttachments,
} from '@/harnesses/claude/drive/attachment-prompt'

test('mentions a file whose path has a space and a quote through a link Claude Code can read', async () => {
  const root = await mkdtemp(join(tmpdir(), 'argo-mention-'))
  try {
    const folder = join(root, 'the "draft" folder')
    await mkdir(folder)
    await writeFile(join(folder, 'notes 1.md'), 'hello')
    const plain = { path: join(root, 'plain.md'), kind: 'file' as const }
    const [linked, kept] = await mentionableAttachments(
      [{ path: join(folder, 'notes 1.md'), kind: 'file' }, plain],
      join(root, 'links'),
    )
    assert.equal(kept, plain)
    assert.doesNotMatch(linked?.path ?? '', /"/)
    assert.match(embedAttachments('', linked ? [linked] : []), /^@"[^"]+notes 1\.md"$/)
    assert.equal(await readFile(linked?.path ?? '', 'utf8'), 'hello')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('links the same file again without failing', async () => {
  const root = await mkdtemp(join(tmpdir(), 'argo-mention-'))
  try {
    const attachment = { path: join(root, 'a "b" c.png'), kind: 'image' as const }
    await writeFile(attachment.path, '')
    const first = await mentionableAttachments([attachment], root)
    assert.deepEqual(await mentionableAttachments([attachment], root), first)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('appends @path mentions after non-empty draft text, separated by a blank line', () => {
  assert.equal(
    embedAttachments('Review this.', [{ path: '/tmp/a.md', kind: 'file' }]),
    'Review this.\n\n@/tmp/a.md',
  )
})

test('joins multiple @path mentions with a space, in attachment order', () => {
  assert.equal(
    embedAttachments('', [
      { path: '/tmp/a.png', kind: 'image' },
      { path: '/tmp/b.md', kind: 'file' },
    ]),
    '@/tmp/a.png @/tmp/b.md',
  )
})

test('quotes a path with a space so Claude Code reads it whole', () => {
  assert.equal(
    embedAttachments('', [
      { path: '/Users/x/Screenshot 2026-09-15 at 06.44.50.png', kind: 'image' },
    ]),
    '@"/Users/x/Screenshot 2026-09-15 at 06.44.50.png"',
  )
})

test('leaves the draft unchanged when there are no attachments', () => {
  assert.equal(embedAttachments('Review this.', []), 'Review this.')
})

test('sends the mentions alone when the draft is only whitespace', () => {
  assert.equal(embedAttachments('   ', [{ path: '/tmp/a.md', kind: 'file' }]), '@/tmp/a.md')
})
