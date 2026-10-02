import assert from 'node:assert/strict'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import type { SessionStartInput } from '@/domains/sessions/main/api'
import type { LiveSessionChannelEvent } from '@/harnesses/registration'
import { writeMockClaude } from '@/mocks/cli/claude/mock-claude-cli'
import { MOCK_CLAUDE_COMMANDS_FILE_ENV } from '@/mocks/cli/claude/mock-claude-sdk-stream'
import { recordedClaudeCommands } from '@/mocks/recordings/claude-cli'
import { SESSION_CLAUDE_EXECUTABLE_ENV } from '../proof-protocol'
import { createClaudeRegistration } from '../registration'

type Listed = Extract<LiveSessionChannelEvent, { type: 'commands' }>

async function waitFor(check: () => boolean, label: string) {
  const deadline = Date.now() + 5_000
  while (!check()) {
    if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${label}`)
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}

async function recordedCommands(): Promise<Record<string, unknown>[]> {
  return structuredClone(recordedClaudeCommands)
}

// The registration reads both variables when it lists or spawns, so each test sets its own.
async function claudeReportingCommands(commands: unknown[]) {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'argo-claude-commands-')))
  const commandsFile = path.join(root, 'commands.json')
  await writeFile(commandsFile, JSON.stringify(commands))
  const executable = await writeMockClaude(root, path.join(root, 'transcripts'))
  const previous = {
    executable: process.env[SESSION_CLAUDE_EXECUTABLE_ENV],
    commands: process.env[MOCK_CLAUDE_COMMANDS_FILE_ENV],
  }
  process.env[SESSION_CLAUDE_EXECUTABLE_ENV] = executable
  process.env[MOCK_CLAUDE_COMMANDS_FILE_ENV] = commandsFile
  return {
    root,
    commandsFile,
    registration: createClaudeRegistration(),
    async stop() {
      for (const [name, value] of [
        [SESSION_CLAUDE_EXECUTABLE_ENV, previous.executable],
        [MOCK_CLAUDE_COMMANDS_FILE_ENV, previous.commands],
      ] as const) {
        if (value === undefined) delete process.env[name]
        else process.env[name] = value
      }
      await rm(root, { recursive: true, force: true })
    },
  }
}

test('lists the commands Claude reports before a Session is live, in the fields every Harness shows', async () => {
  const claude = await claudeReportingCommands(await recordedCommands())
  try {
    const listing = await claude.registration.listCommands?.({ cwd: claude.root })
    assert.deepEqual(
      listing?.commands.map(({ name, argumentHint, aliases }) => ({ name, argumentHint, aliases })),
      [
        { name: 'loop', argumentHint: '[interval] [prompt]', aliases: ['proactive'] },
        { name: 'ask-matt', argumentHint: '', aliases: [] },
        {
          name: 'claude-handoff',
          argumentHint: 'What will the next session be used for?',
          aliases: [],
        },
      ],
    )
    assert.equal(
      listing?.commands[1]?.description,
      'Ask which skill or flow fits your situation. A router over the skills in this repo. (project)',
    )
  } finally {
    await claude.stop()
  }
})

test('counts a command shape it cannot read and lists the rest', async () => {
  const [command] = await recordedCommands()
  const claude = await claudeReportingCommands([command, { name: 'bad name', description: 'x' }])
  const warnings: unknown[][] = []
  const warn = console.warn
  console.warn = (...args: unknown[]) => warnings.push(args)
  try {
    const listing = await claude.registration.listCommands?.({ cwd: claude.root })
    assert.deepEqual(
      listing?.commands.map(({ name }) => name),
      ['loop'],
    )
    assert.deepEqual(warnings, [['Rejected 1 unsupported Claude command shape(s).']])
  } finally {
    console.warn = warn
    await claude.stop()
  }
})

test('a live Session replaces its command list when Claude pushes a change', async () => {
  const [, skill] = await recordedCommands()
  const claude = await claudeReportingCommands([skill])
  const events: LiveSessionChannelEvent[] = []
  const input: SessionStartInput = {
    commandId: '00000000-0000-4000-8000-000000000001',
    harness: 'claude',
    projectId: '00000000-0000-4000-8000-000000000099',
    worktree: null,
    cwd: claude.root,
    prompt: 'first',
    attachments: [],
    turnConfiguration: { model: 'sonnet', effort: 'medium', mode: 'manual' },
  }
  const channel = claude.registration.openLiveSession?.(input, undefined, (event) =>
    events.push(event),
  )
  const listed = () =>
    events.flatMap((event): Listed[] => (event.type === 'commands' ? [event] : []))
  try {
    await waitFor(() => listed().length === 1, 'the first command list')
    assert.deepEqual(
      listed()[0]?.commands.map(({ name }) => name),
      ['ask-matt'],
    )
    await waitFor(() => events.some((event) => event.type === 'turn.completed'), 'the first Turn')
    await writeFile(claude.commandsFile, JSON.stringify([skill, { ...skill, name: 'review' }]))
    await waitFor(() => listed().at(-1)?.commands.length === 2, 'the pushed command list')
    assert.deepEqual(
      listed()
        .at(-1)
        ?.commands.map(({ name }) => name),
      ['ask-matt', 'review'],
    )
  } finally {
    channel?.close()
    await claude.stop()
  }
})
