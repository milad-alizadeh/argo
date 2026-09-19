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
import { toolCallsOf } from '../domains/sessions/main/tool-calls-of'
import { claudeSessionSource } from './claude/sessions/read-sessions'
import { readerOverRollout } from './codex/sessions/rollout-reader-test-helper'

const SESSIONS = fileURLToPath(new URL('../../mocks/cli', import.meta.url))
type Context = { after: (cleanup: () => Promise<void>) => void }

const HARNESSES = {
  claude: async (context: Context, session: string) => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'argo-parity-claude-'))
    context.after(() => rm(root, { recursive: true, force: true }))
    await mkdir(path.join(root, 'project-one'), { recursive: true })
    await copyFile(
      path.join(SESSIONS, `claude/fixtures/sessions/${session}.jsonl`),
      path.join(root, 'project-one', `${session}.jsonl`),
    )
    return createSessionReader([claudeSessionSource({ transcripts: root })])
  },
  codex: (context: Context, session: string) =>
    readerOverRollout(context, { fixture: `rollout-${session}.jsonl`, session }),
}

async function read(harness: keyof typeof HARNESSES, context: Context, session = 'parityExecute') {
  const reader = await HARNESSES[harness](context, session)
  const feed = rowsOf(await fed(reader, feedRequest(session)))
  const roster = (await listed(reader))?.sessions.find((row) => row.id === session)
  assert.ok(roster !== undefined, `${harness} lists the Session`)
  return { feed, roster }
}

// What each harness lacks for a command, by name: Claude has no exit code in a result and Codex
// records no description for a call, so neither surface may draw a value for it.
test('a command reads the same for Claude and for Codex', async (context) => {
  const claude = await read('claude', context)
  const codex = await read('codex', context)

  const expected = [
    { kind: 'command', status: 'succeeded', label: 'Ran bun test', text: 'bun test' },
    { kind: 'command', status: 'failed', label: 'Ran bun run lint', text: 'bun run lint' },
    { kind: 'command', status: 'running', label: 'Ran bun run build', text: 'bun run build' },
  ]
  assert.deepEqual(toolCallsOf(claude.feed), expected)
  assert.deepEqual(toolCallsOf(codex.feed), expected)

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

// What each harness lacks for a lookup, by name: Codex writes no typed file search, so a file
// search is a Claude row only, and neither harness records a page or query outcome here.
test('a file read, a web search and a web fetch read the same for Claude and for Codex', async (context) => {
  const claude = await read('claude', context, 'parityLookup')
  const codex = await read('codex', context, 'parityLookup')

  const expected = [
    { kind: 'read', status: 'succeeded', label: 'Read shot.png', text: null },
    { kind: 'searched', status: 'succeeded', label: 'Searched argo cockpit', text: 'argo cockpit' },
    {
      kind: 'searched',
      status: 'succeeded',
      label: 'Fetched https://example.com/argo',
      text: 'https://example.com/argo',
    },
  ]
  assert.deepEqual(toolCallsOf(claude.feed), expected)
  assert.deepEqual(toolCallsOf(codex.feed), expected)
  assert.equal(claude.roster.status, codex.roster.status)
})

// What each harness lacks here, by name: neither records a server or tool fact outside the call's
// name, and only Claude has a Skill tool, so a skill row is a Claude case alone (see the Claude
// integration test). A poll or wait call draws no row in either.
test('an MCP call reads the same for Claude and for Codex, and a poll draws no row', async (context) => {
  const claude = await read('claude', context, 'parityOrchestration')
  const codex = await read('codex', context, 'parityOrchestration')

  const expected = [
    { kind: 'tool', status: 'succeeded', label: 'github · list_issues', text: null },
  ]
  assert.deepEqual(toolCallsOf(claude.feed), expected)
  assert.deepEqual(toolCallsOf(codex.feed), expected)
  assert.equal(claude.roster.status, codex.roster.status)
})

// What each harness lacks for an edit, by name: Claude has no tool that deletes a file, so a
// deletion is a Codex row only (see `codexDelete`), and Codex writes no per-file result, so a
// multi-file patch shares one status across its rows.
test('a written file and two edits read the same for Claude and for Codex', async (context) => {
  const claude = await read('claude', context, 'parityEdit')
  const codex = await read('codex', context, 'parityEdit')

  const expected = [
    { kind: 'created', status: 'succeeded', label: 'Created notes.md', text: null },
    { kind: 'edited', status: 'succeeded', label: 'Edited app.ts', text: null },
    { kind: 'edited', status: 'succeeded', label: 'Edited util.ts', text: null },
  ]
  assert.deepEqual(toolCallsOf(claude.feed), expected)
  assert.deepEqual(toolCallsOf(codex.feed), expected)
  assert.equal(claude.roster.status, codex.roster.status)
  // The Roster names the newest file either way; `tool` is the harness's own name and differs.
  const activity = (row: typeof claude.roster) => {
    const { kind, label, target } = row.activity ?? { kind: null, label: null, target: null }
    return { kind, label, target }
  }
  assert.deepEqual(activity(claude.roster), activity(codex.roster))
})

// What each harness lacks for a Subagent, by name: Codex writes no reply, so its `responded` row
// has no `text`, and neither harness records a duration or a token count in the transcript.
test('a Subagent started, messaged and answered reads the same for Claude and for Codex', async (context) => {
  const claude = await read('claude', context, 'paritySubagent')
  const codex = await read('codex', context, 'paritySubagent')

  const events = (feed: typeof claude.feed) =>
    feed.flatMap((row) =>
      row.shape === 'subagent'
        ? [{ event: row.event, state: row.state ?? null, name: row.name ?? null }]
        : [],
    )
  const expected = [
    { event: 'started', state: null, name: 'Review feed' },
    { event: 'messaged', state: null, name: 'Review feed' },
    { event: 'responded', state: 'completed', name: 'Review feed' },
  ]
  assert.deepEqual(events(claude.feed), expected)
  assert.deepEqual(events(codex.feed), expected)

  const absent = (feed: typeof claude.feed) =>
    feed.flatMap((row) =>
      row.shape === 'subagent' && row.event === 'responded'
        ? [
            {
              text: row.text ?? null,
              durationMs: row.durationMs ?? null,
              tokens: row.tokens ?? null,
            },
          ]
        : [],
    )
  assert.deepEqual(absent(claude.feed), [
    { text: 'Every row draws once.', durationMs: null, tokens: null },
  ])
  assert.deepEqual(absent(codex.feed), [{ text: null, durationMs: null, tokens: null }])

  // The id is the harness's own (a call id, a thread id), so the Roster row is compared without it.
  const subagent = (row: typeof claude.roster) =>
    row.subagents.map(({ label, state, startedAt, endedAt }) => ({
      label,
      state,
      startedAt,
      endedAt,
    }))
  const times = { startedAt: '2026-09-19T10:00:01.000Z', endedAt: '2026-09-19T10:00:03.000Z' }
  const row = { label: 'Review feed', state: 'completed', ...times }
  assert.deepEqual(subagent(claude.roster), [row])
  assert.deepEqual(subagent(codex.roster), [row])
})
