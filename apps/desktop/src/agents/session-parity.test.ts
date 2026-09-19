// The parity suite (#2443): one scenario written as a Claude transcript and as a Codex transcript,
// each read through its own harness's Session source, must draw the same Feed rows and the same
// Roster row. A case names every fact one harness lacks, so a lost row cannot pass as a difference.
import assert from 'node:assert/strict'
import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createSessionReader } from '../domains/sessions/main/reader'
import { fed, feedRequest, listed, rowsOf } from '../domains/sessions/main/reader-test-helpers'
import { claudeSessionSource } from './claude/sessions/read-sessions'
import { readerOverRollout } from './codex/sessions/rollout-reader-test-helper'

const SESSIONS = fileURLToPath(new URL('../../mocks/cli', import.meta.url))
type Context = { after: (cleanup: () => Promise<void>) => void }

const HARNESSES = {
  claude: async (context: Context) => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'argo-parity-claude-'))
    context.after(() => rm(root, { recursive: true, force: true }))
    await mkdir(path.join(root, 'project-one'), { recursive: true })
    await copyFile(
      path.join(SESSIONS, 'claude/fixtures/sessions/parityExecute.jsonl'),
      path.join(root, 'project-one', 'parityExecute.jsonl'),
    )
    return createSessionReader([claudeSessionSource({ transcripts: root })])
  },
  codex: (context: Context) =>
    readerOverRollout(context, {
      fixture: 'rollout-parityExecute.jsonl',
      session: 'parityExecute',
    }),
}

async function read(harness: keyof typeof HARNESSES, context: Context) {
  const reader = await HARNESSES[harness](context)
  const feed = rowsOf(await fed(reader, feedRequest('parityExecute')))
  const roster = (await listed(reader))?.sessions.find((row) => row.id === 'parityExecute')
  assert.ok(roster !== undefined, `${harness} lists the Session`)
  return { feed, roster }
}

// What each harness lacks for a command, by name: Claude has no exit code in a result and Codex
// records no description for a call, so neither surface may draw a value for it.
test('a command reads the same for Claude and for Codex', async (context) => {
  const claude = await read('claude', context)
  const codex = await read('codex', context)

  const calls = (feed: typeof claude.feed) =>
    feed.flatMap((row) =>
      row.shape === 'tool-group'
        ? row.calls.map(({ kind, status, label, text }) => ({ kind, status, label, text }))
        : [],
    )
  const expected = [
    { kind: 'command', status: 'succeeded', label: 'Ran bun test', text: 'bun test' },
    { kind: 'command', status: 'failed', label: 'Ran bun run lint', text: 'bun run lint' },
    { kind: 'command', status: 'running', label: 'Ran bun run build', text: 'bun run build' },
  ]
  assert.deepEqual(calls(claude.feed), expected)
  assert.deepEqual(calls(codex.feed), expected)

  const shell = (row: typeof claude.roster) =>
    row.shell.map(({ command, label, background, state, outputPath, result }) => ({
      command,
      label,
      background,
      state,
      outputPath,
      result,
    }))
  // A running foreground command is the only one the Shell list keeps, and no harness gives it a
  // description (`label`), an output file or a result.
  const running = [
    {
      command: 'bun run build',
      label: null,
      background: false,
      state: 'running',
      outputPath: null,
      result: null,
    },
  ]
  assert.deepEqual(shell(claude.roster), running)
  assert.deepEqual(shell(codex.roster), running)
})
