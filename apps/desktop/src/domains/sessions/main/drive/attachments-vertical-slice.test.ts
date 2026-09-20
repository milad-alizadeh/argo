// The #1845 vertical slice: a chooser hands back real paths, one of them goes missing before
// Send, and the survivor reaches the prompt as Claude Code's own `@path` mention while the
// missing one is reported so the renderer can keep it for retry (embedAttachments itself is
// renderer-only, so this proves the domain-side half of the flow the Storybook stories complete).
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { chooseAttachments, statAttachments } from '@/domains/sessions/main/drive/attachments'

test('a chosen file that is still readable reaches the Turn as an @-mention', async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'argo-attachments-slice-'))
  context.after(() => rm(directory, { recursive: true, force: true }))

  const kept = path.join(directory, 'brief.md')
  await writeFile(kept, 'Ship the composer.')
  const gone = path.join(directory, 'screenshot.png')
  await writeFile(gone, 'temporary')
  await rm(gone)

  const chosen = await chooseAttachments(
    { version: 1, type: 'session.attachments.choose', requestId: 'choose-1' },
    { chooseFiles: async () => [kept, gone] },
  )
  assert.equal(chosen.type, 'session.attachments.chosen')
  const paths = chosen.type === 'session.attachments.chosen' ? chosen.paths : []

  const stated = await statAttachments({
    version: 1,
    type: 'session.attachments.stat',
    requestId: 'stat-1',
    paths,
  })
  assert.deepEqual(stated, {
    version: 1,
    type: 'session.attachments.statted',
    requestId: 'stat-1',
    files: [
      { path: kept, readable: true },
      { path: gone, readable: false },
    ],
  })

  const readable =
    stated.type === 'session.attachments.statted'
      ? stated.files.filter((file) => file.readable).map((file) => file.path)
      : []
  const prompt = `Review this.\n\n${readable.map((readablePath) => `@${readablePath}`).join(' ')}`
  assert.equal(prompt, `Review this.\n\n@${kept}`)
})
