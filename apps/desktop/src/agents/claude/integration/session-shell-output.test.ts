import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import {
  pointShellOutputAtRoot,
  shellOutputRoot,
} from '../../../../mocks/sessions/mock-shell-output'
import { createSessionReader } from '../../../domains/sessions/main/reader'
import { claudeSessionSource } from '../sessions/read-sessions.ts'
import { fixtureRoot } from './session-fixtures'

function request(shellId: string) {
  return {
    version: 1,
    type: 'session.shell.output',
    requestId: 'output-1',
    sessionId: 'shellRunning',
    shellId,
  }
}

async function readOutput(root: string, shellId: string) {
  return createSessionReader([claudeSessionSource({ transcripts: root })]).readShellOutput(
    request(shellId),
  )
}

test('reads a background Shell by its call, from the file the receipt named', async (context) => {
  const root = await fixtureRoot(context, ['shellRunning'])
  await pointShellOutputAtRoot(root, root)
  await writeFile(path.join(shellOutputRoot(root), 'build.output'), 'building\ndone in 3s\n')
  const reply = await readOutput(root, 'sh-call-build')
  assert.equal(reply.type, 'session.shell.output.read')
  assert.equal(reply.shellId, 'sh-call-build')
  assert.equal(reply.output, 'building\ndone in 3s\n')
})

// A foreground command records no output source, and a command whose file the CLI cleaned up no
// longer has one. Both read as no output rather than as a failure of the pane around them.
test('reads no output where the Shell recorded no source', async (context) => {
  const root = await fixtureRoot(context, ['shellRunning'])
  const foreground = await readOutput(root, 'sh-call-suite')
  assert.equal(foreground.output, null)
  const unknown = await readOutput(root, 'no-such-call')
  assert.equal(unknown.output, null)
})
