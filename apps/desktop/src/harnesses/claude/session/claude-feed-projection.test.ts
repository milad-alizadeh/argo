import { afterEach, beforeEach, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import { ClaudeFeedProjection } from './claude-feed-projection'

function agentCall(callId: string, prompt: string): FeedContent {
  return {
    kind: 'tool',
    id: callId,
    callId,
    name: 'Agent',
    status: 'running',
    input: { description: 'Survey adapters', prompt },
    output: null,
    summary: null,
  }
}

function agentResult(callId: string, text: string): FeedContent {
  return {
    kind: 'tool',
    id: `${callId}:result`,
    callId,
    name: '',
    status: 'completed',
    input: null,
    output: [{ kind: 'text', text }],
    summary: null,
  }
}

function delegationEnvelope(
  id: string,
  status: 'running' | 'completed',
  prompt = `Input ${id}`,
): FeedContent {
  return {
    kind: 'delegation',
    id,
    event: status === 'running' ? 'started' : 'responded',
    agentId: 'feed-review',
    status,
    name: null,
    prompt,
    model: null,
    summary: null,
  }
}

test('reads a foreground Agent result as its start and its reply', () => {
  const projection = new ClaudeFeedProjection(() => null)
  expect(projection.project(agentCall('call-1', 'Survey the adapters'))).toEqual([])
  const projected = projection.project(
    agentResult('call-1', 'Found two adapters.\nagentId: a1b2c3 (for resuming)\n<usage>1</usage>'),
  )
  expect(projected).toMatchObject([
    { id: 'call-1', event: 'started', status: 'running', prompt: 'Survey the adapters' },
    {
      id: 'call-1:response',
      event: 'responded',
      status: 'completed',
      prompt: null,
      summary: 'Found two adapters.',
    },
  ])
})

test('reads a background Agent launch as its start alone', () => {
  const projection = new ClaudeFeedProjection(() => null)
  projection.project(agentCall('call-2', 'Keep going'))
  expect(
    projection.project(agentResult('call-2', 'Async agent launched\nagentId: b2c3d4 (internal)')),
  ).toMatchObject([{ id: 'call-2', event: 'started', agentId: 'b2c3d4' }])
})

test('reads a repeated delegation envelope with a new input as a message to it', () => {
  const projection = new ClaudeFeedProjection(() => null)
  const events = ['first', 'second', 'third'].flatMap((id, index) =>
    projection.project(delegationEnvelope(id, index === 2 ? 'completed' : 'running')),
  )
  expect(events.map((event) => (event.kind === 'delegation' ? event.event : null))).toEqual([
    'started',
    'messaged',
    'responded',
  ])
})

test('records no event for a repeated delegation envelope with the same input', () => {
  const projection = new ClaudeFeedProjection(() => null)
  projection.project(delegationEnvelope('first', 'running', 'Review the Feed card'))
  expect(
    projection.project(delegationEnvelope('progress', 'running', 'Review the Feed card')),
  ).toEqual([])
})

let root: string

beforeEach(() => {
  root = mkdtempSync(path.join(os.tmpdir(), 'argo-claude-projection-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function command(id: string, text: string): FeedContent {
  return {
    kind: 'command',
    id,
    command: text,
    cwd: null,
    status: 'completed',
    output: null,
    stderr: null,
    exitCode: null,
  }
}

function skillFolder(name: string): string {
  const folder = path.join(root, name)
  mkdirSync(folder, { recursive: true })
  writeFileSync(path.join(folder, 'SKILL.md'), `# ${name}\n`)
  return folder
}

test('expands a skill row to the folder the transcript recorded, not the one on disk now', () => {
  const recorded = skillFolder('implement')
  const projection = new ClaudeFeedProjection(
    () => path.join(root, 'elsewhere', 'SKILL.md'),
    () => new Map([['command-1', recorded]]),
  )

  expect(projection.project(command('command-1', '/implement 2861'))).toEqual([
    {
      id: 'command-1',
      kind: 'reference',
      referenceType: 'skill',
      label: 'implement',
      target: path.join(recorded, 'SKILL.md'),
      text: '2861',
    },
  ])
})

test('keeps a skill row with no expansion once its recorded folder is gone', () => {
  const projection = new ClaudeFeedProjection(
    () => null,
    () => new Map([['command-2', path.join(root, 'deleted')]]),
  )

  expect(projection.project(command('command-2', '/deleted'))).toMatchObject([
    { kind: 'reference', referenceType: 'skill', label: 'deleted', target: null },
  ])
})

test('falls back to the disk lookup when the transcript recorded no folder', () => {
  const projection = new ClaudeFeedProjection(() => null)

  expect(projection.project(command('command-3', '/clear'))).toMatchObject([{ kind: 'command' }])
})
