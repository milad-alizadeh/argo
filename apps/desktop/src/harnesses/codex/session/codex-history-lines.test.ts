import { afterEach, expect, test } from 'bun:test'
import {
  appendFileSync,
  copyFileSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import { latestTurn } from '@/harnesses/host/history-watch'
import { scanRollouts } from '../../../../mocks/cli/codex/mock-codex-rollout-history.ts'
import type { CodexRequest } from '../app-server/codex-app-server-client'
import { codexHistoryOwner, codexHistoryTurn, openCodexHistoryReader } from './codex-history-lines'
import { readCodexSessionHistory } from './codex-session-history'

const FIXTURES = fileURLToPath(
  new URL('../../../../mocks/cli/codex/fixtures/sessions', import.meta.url),
)
const previous = process.env.ARGO_CODEX_TRANSCRIPTS

afterEach(() => {
  if (previous === undefined) delete process.env.ARGO_CODEX_TRANSCRIPTS
  else process.env.ARGO_CODEX_TRANSCRIPTS = previous
})

const rollouts = readdirSync(FIXTURES).filter((name) => name.startsWith('rollout-'))

test.each(rollouts)('streams %s as the messages a full thread read returns', async (name) => {
  process.env.ARGO_CODEX_TRANSCRIPTS = FIXTURES
  const threadId = path.basename(name, '.jsonl')
  const thread = scanRollouts().find((candidate) => candidate.id === threadId)
  if (thread === undefined) throw new Error(`The recorded Codex thread ${threadId} is missing.`)
  const request = (async (_method: string, _params: unknown, parse: (value: unknown) => unknown) =>
    parse({ thread })) as CodexRequest
  const full = await readCodexSessionHistory(request, threadId)
  const lines = readFileSync(path.join(FIXTURES, name), 'utf8').split('\n').filter(Boolean)

  const streamed = openCodexHistoryReader()(lines)

  if (streamed.type !== 'appended') throw new Error('The rollout did not stream.')
  // The mock's thread read keeps a user message's surrounding whitespace; the app-server trims it.
  const trimmed = (content: FeedContent) =>
    content.kind === 'message' ? { ...content, text: content.text.trim() } : content
  expect(
    streamed.events.map((event) => (event.type === 'content' ? trimmed(event.content) : null)),
  ).toEqual(full.map(trimmed))
})

test('counts a line that is not a rollout record', () => {
  const warnings: unknown[] = []
  const warn = console.warn
  console.warn = (message: unknown) => warnings.push(message)
  try {
    expect(
      openCodexHistoryReader()([
        '{"type":"turn_context","payload":{"turn_id":"t"}}',
        '{"type":"event_msg","payload":{"type":"item_completed","item":{"type":"Reasoning","id":"rs"}}}',
        'not json',
      ]),
    ).toEqual({ type: 'appended', events: [] })
  } finally {
    console.warn = warn
  }
  expect(warnings).toEqual(['Rejected 1 unsupported Codex rollout line(s).'])
})

test('asks for a full read when a rollout completes a command', () => {
  expect(
    openCodexHistoryReader()([
      '{"type":"event_msg","payload":{"type":"item_completed","item":{"type":"AgentMessage","id":"m","content":[{"type":"Text","text":"Running it"}]}}}',
      '{"type":"event_msg","payload":{"type":"item_completed","item":{"type":"CommandExecution","id":"c","command":"ls"}}}',
    ]),
  ).toEqual({ type: 'rewritten' })
})

test('names the thread a rollout file belongs to', () => {
  expect(
    codexHistoryOwner(
      '2026/09/28/rollout-2026-09-28T17-28-10-01a0e8d8-6461-7692-b276-32329518363e.jsonl',
    ),
  ).toBe('01a0e8d8-6461-7692-b276-32329518363e')
  expect(codexHistoryOwner('2026/09/10/rollout-codexChild.jsonl')).toBe('rollout-codexChild')
  expect(codexHistoryOwner('2026/09/10/session_index.jsonl')).toBeNull()
  expect(codexHistoryOwner('2026/09/10')).toBeNull()
})

test.each([
  ['task_started', 'open'],
  ['task_complete', 'closed'],
  ['turn_aborted', 'closed'],
  ['token_count', null],
] as const)('reads a %s event as a turn that is %p', (type, turn) => {
  expect(
    codexHistoryTurn(JSON.stringify({ type: 'event_msg', payload: { type, turn_id: 'turn-1' } })),
  ).toEqual(turn === null ? null : { turn, turnId: 'turn-1' })
})

test('reads a marker without a turn id as one that names no turn', () => {
  expect(
    codexHistoryTurn(JSON.stringify({ type: 'event_msg', payload: { type: 'task_complete' } })),
  ).toEqual({ turn: 'closed', turnId: null })
})

// Codex aborts a replaced turn after it starts the next one; the late abort must not end it.
test('keeps a watched Session running when an earlier turn closes after the next starts', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'argo-codex-turn-'))
  try {
    const file = path.join(directory, 'rollout-codexReplacedTurn.jsonl')
    copyFileSync(path.join(FIXTURES, 'rollout-codexReplacedTurn.jsonl'), file)
    expect(latestTurn(file, codexHistoryTurn)).toBe('open')

    appendFileSync(
      file,
      `${JSON.stringify({
        type: 'event_msg',
        payload: { type: 'task_complete', turn_id: '01a0b000-0000-7000-8000-00000000b002' },
      })}\n`,
    )
    expect(latestTurn(file, codexHistoryTurn)).toBe('closed')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('reads a line that is not an event as no turn change', () => {
  expect(codexHistoryTurn('{"type":"response_item","payload":{"type":"message"}}')).toBeNull()
  expect(codexHistoryTurn('not json')).toBeNull()
})
