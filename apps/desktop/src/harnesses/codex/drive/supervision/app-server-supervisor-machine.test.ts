import assert from 'node:assert/strict'
import { test } from 'node:test'
import { processExitIsCurrent } from './app-server-supervisor-machine'
import type { CodexChannel } from './codex-channel'

test('ignores the exit of a superseded app-server channel', () => {
  const oldChannel = {} as CodexChannel
  const replacement = {} as CodexChannel

  assert.equal(processExitIsCurrent(oldChannel, replacement), false)
  assert.equal(processExitIsCurrent(replacement, replacement), true)
})
