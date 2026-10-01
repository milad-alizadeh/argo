import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { getSessionMessages } from '@anthropic-ai/claude-agent-sdk'
import { openClaudeHistoryReader } from './claude-history-lines'
import { decodeClaudeSessionMessages } from './claude-session-history'

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

test('streams a skill slash command as the command it ran', () => {
  const streamed = openClaudeHistoryReader()(recorded('harnessNoise'))
  if (streamed.type !== 'appended') throw new Error('The transcript did not stream.')
  const contents = streamed.events.map((event) => (event.type === 'content' ? event.content : null))

  expect(contents).toContainEqual(
    expect.objectContaining({ id: 'u-implement', kind: 'command', command: expect.any(String) }),
  )
  expect(contents).not.toContainEqual(expect.objectContaining({ kind: 'reference' }))
})
