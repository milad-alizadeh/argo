import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { getSessionMessages } from '@anthropic-ai/claude-agent-sdk'
import {
  claudeHistoryOwner,
  claudeHistoryTurn,
  openClaudeHistoryReader,
} from './claude-history-lines'
import { decodeClaudeSessionMessages } from './claude-session-history'
import { claudeSkillFiles } from './claude-skill-files'

const FIXTURES = new URL('../../../../mocks/cli/claude/fixtures/sessions/', import.meta.url)

function recorded(name: string): string[] {
  return readFileSync(new URL(`${name}.jsonl`, FIXTURES), 'utf8')
    .split('\n')
    .filter((line) => line.trim() !== '')
}

test.each(['toolCalls', 'harnessNoise', 'askPending', 'recordedEdit'])(
  'streams the %s transcript as the same content a full read decodes',
  async (name) => {
    const home = await realpath(await mkdtemp(path.join(os.tmpdir(), 'argo-claude-lines-')))
    const previous = process.env.CLAUDE_CONFIG_DIR
    try {
      const cwd = path.join(home, 'work')
      const project = path.join(home, 'projects', cwd.replace(/[^a-zA-Z0-9]/g, '-'))
      await mkdir(project, { recursive: true })
      for (const skill of ['diagnosing-bugs', 'implement']) {
        await mkdir(path.join(cwd, '.claude', 'skills', skill), { recursive: true })
        await writeFile(path.join(cwd, '.claude', 'skills', skill, 'SKILL.md'), '')
      }
      const lines = recorded(name).map((line) => {
        const record = JSON.parse(line)
        return JSON.stringify({ ...record, sessionId: '00000000-0000-4000-8000-000000000009', cwd })
      })
      await writeFile(
        path.join(project, '00000000-0000-4000-8000-000000000009.jsonl'),
        `${lines.join('\n')}\n`,
      )
      process.env.CLAUDE_CONFIG_DIR = home
      const full = decodeClaudeSessionMessages(
        await getSessionMessages('00000000-0000-4000-8000-000000000009', { dir: cwd }),
        claudeSkillFiles(cwd),
      )

      const streamed = openClaudeHistoryReader()(lines)

      expect(full.length).toBeGreaterThan(0)
      if (streamed.type !== 'appended') throw new Error('The transcript did not stream.')
      expect(
        streamed.events.map((event) => (event.type === 'content' ? event.content : null)),
      ).toEqual(full)
    } finally {
      if (previous === undefined) delete process.env.CLAUDE_CONFIG_DIR
      else process.env.CLAUDE_CONFIG_DIR = previous
      await rm(home, { recursive: true, force: true })
    }
  },
)

test.each(['prose', 'parityProse'])(
  'reports the %s transcript, whose records branch or start a second root, as a rewrite',
  (name) => {
    expect(openClaudeHistoryReader()(recorded(name))).toEqual({ type: 'rewritten' })
  },
)

test('reads a compaction boundary as a continuation of the chain', () => {
  const read = openClaudeHistoryReader()
  read(['{"type":"user","uuid":"u-1","parentUuid":null,"message":{"role":"user","content":"one"}}'])
  expect(
    read(['{"type":"system","uuid":"c-1","parentUuid":null,"logicalParentUuid":"u-1"}']),
  ).toEqual({ type: 'appended', events: [] })
})

test('keeps its place in the chain across appends', () => {
  const read = openClaudeHistoryReader()
  read(['{"type":"user","uuid":"u-1","parentUuid":null,"message":{"role":"user","content":"one"}}'])
  expect(
    read([
      '{"type":"user","uuid":"u-2","parentUuid":"u-1","message":{"role":"user","content":"two"}}',
    ]),
  ).toMatchObject({ type: 'appended', events: [{ vendorEventId: 'u-2' }] })
  expect(
    read([
      '{"type":"user","uuid":"u-3","parentUuid":"u-1","message":{"role":"user","content":"fork"}}',
    ]),
  ).toEqual({ type: 'rewritten' })
})

test('takes its place in the chain from the lines already in the file', () => {
  const read = openClaudeHistoryReader([
    '{"type":"user","uuid":"u-1","parentUuid":null,"message":{"role":"user","content":"one"}}',
    '{"type":"user","uuid":"u-2","parentUuid":"u-1","message":{"role":"user","content":"two"}}',
    '{"type":"user","uuid":"side","parentUuid":"u-2","isSidechain":true}',
  ])
  expect(
    read([
      '{"type":"user","uuid":"u-3","parentUuid":"u-1","message":{"role":"user","content":"fork"}}',
    ]),
  ).toEqual({ type: 'rewritten' })
})

test('skips transcript bookkeeping and counts a line that is not a record', () => {
  const warnings: unknown[] = []
  const warn = console.warn
  console.warn = (message: unknown) => warnings.push(message)
  try {
    expect(
      openClaudeHistoryReader()([
        '{"type":"summary","summary":"Earlier work","leafUuid":"x"}',
        '{"type":"user","uuid":"meta","isMeta":true,"message":{"role":"user","content":"hidden"}}',
        '{"type":"assistant","uuid":"side","parentUuid":"elsewhere","isSidechain":true,"message":{"role":"assistant","content":[]}}',
        'not json',
      ]),
    ).toEqual({ type: 'appended', events: [] })
  } finally {
    console.warn = warn
  }
  expect(warnings).toEqual(['Rejected 1 unsupported Claude history line(s).'])
})

test('names the Session or Subagent a transcript file belongs to', () => {
  expect(claudeHistoryOwner('-Users-x-work/session-1.jsonl')).toBe('session-1')
  expect(claudeHistoryOwner('-Users-x-work/session-1/subagents/agent-a1.jsonl')).toBe('a1')
  expect(claudeHistoryOwner('-Users-x-work/session-1')).toBeNull()
})

test.each([
  ['a prompt', '{"type":"user","uuid":"u","message":{"role":"user","content":"Fix it"}}', 'open'],
  [
    'a prompt with blocks',
    '{"type":"user","uuid":"u","message":{"role":"user","content":[{"type":"text","text":"Fix it"}]}}',
    'open',
  ],
  [
    'a tool result',
    '{"type":"user","uuid":"u","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"t","content":"ok"}]}}',
    null,
  ],
  [
    'a tool call',
    '{"type":"assistant","uuid":"a","message":{"role":"assistant","stop_reason":"tool_use","content":[]}}',
    null,
  ],
  [
    'a final answer',
    '{"type":"assistant","uuid":"a","message":{"role":"assistant","stop_reason":"end_turn","content":[]}}',
    'closed',
  ],
  ['the turn duration', '{"type":"system","subtype":"turn_duration","durationMs":10}', 'closed'],
  [
    'an interruption',
    '{"type":"user","uuid":"u","message":{"role":"user","content":[{"type":"text","text":"[Request interrupted by user for tool use]"}]}}',
    'closed',
  ],
  [
    'a meta prompt',
    '{"type":"user","uuid":"u","isMeta":true,"message":{"role":"user","content":"hidden"}}',
    null,
  ],
  [
    'a Subagent turn',
    '{"type":"assistant","uuid":"a","isSidechain":true,"message":{"role":"assistant","stop_reason":"end_turn","content":[]}}',
    null,
  ],
  ['a broken line', 'not json', null],
] as const)('reads %s as a turn that is %p', (_name, line, turn) => {
  expect(claudeHistoryTurn(line)).toEqual(turn === null ? null : { turn, turnId: null })
})

test('an edit result read after its call settles the edit rather than drawing a bare call', () => {
  const lines = recorded('recordedEdit')
  const streamed = openClaudeHistoryReader(lines.slice(0, 2))(lines.slice(2, 3))
  if (streamed.type !== 'appended') throw new Error('The transcript did not stream.')
  expect(streamed.events.map((event) => (event.type === 'content' ? event.content : null))).toEqual(
    [
      {
        id: 'toolu_01QcoWSLSMjQ9e4NFtQ5Aq7F',
        kind: 'fileChange',
        status: 'completed',
        changes: [
          {
            path: '/Users/x/argo/apps/desktop/src/domains/sessions/api/feed/tool-groups.ts',
            change: 'update',
            diff: expect.stringContaining('+function toolGroupLabel'),
          },
        ],
      },
    ],
  )
})

test('resolves a streamed skill against the folder its records name', async () => {
  const cwd = await realpath(await mkdtemp(path.join(os.tmpdir(), 'argo-claude-skill-')))
  try {
    const skill = path.join(cwd, '.claude', 'skills', 'implement', 'SKILL.md')
    await mkdir(path.dirname(skill), { recursive: true })
    await writeFile(skill, '')
    const lines = recorded('harnessNoise').map((line) =>
      JSON.stringify({ ...JSON.parse(line), cwd }),
    )
    const streamed = openClaudeHistoryReader()(lines)
    if (streamed.type !== 'appended') throw new Error('The transcript did not stream.')
    const contents = streamed.events.map((event) =>
      event.type === 'content' ? event.content : null,
    )
    expect(contents).toContainEqual(
      expect.objectContaining({ kind: 'reference', label: 'implement', target: skill }),
    )
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})
