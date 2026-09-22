// The parity suite (#2443): one scenario written as a Claude transcript and as a Codex transcript,
// each read through its own harness's Session source, must draw the same Feed rows and the same
// Roster row. A case names every fact one harness lacks, so a lost row cannot pass as a difference.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { toolCallsOf } from '@/domains/sessions/main/projection/feed/tool-calls-of'
import { read } from './session-parity-harnesses'

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
