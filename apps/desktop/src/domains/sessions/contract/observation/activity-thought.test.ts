import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ContentBlock, ToolCall, TranscriptMessage } from '../model/transcript'
import { readActivity } from './signals'

const BASE: Omit<TranscriptMessage, 'uuid' | 'role' | 'blocks' | 'toolCalls'> = {
  kind: 'message',
  parentUuid: null,
  originSessionId: null,
  sidechain: false,
  cwd: null,
  branch: null,
  timestamp: '2026-09-18T00:00:00.000Z',
  entry: 'interactive',
  stopReason: null,
  model: null,
  effort: null,
  mode: null,
  answeredCalls: [],
  usage: null,
}

function said(uuid: string, role: 'user' | 'assistant', blocks: ContentBlock[]): TranscriptMessage {
  return { ...BASE, uuid, role, blocks, toolCalls: [] }
}

function called(uuid: string, ...toolCalls: ToolCall[]): TranscriptMessage {
  return { ...BASE, uuid, role: 'assistant', blocks: [], toolCalls }
}

const PROMPT = said('prompt', 'user', [{ shape: 'prose', text: 'do the thing' }])
const HEADLINE = 'Refining exact selection style selectors'
const THINKING = said('thinking', 'assistant', [{ shape: 'thought', text: HEADLINE }])
const CALL = called('call', {
  id: 'call-1',
  kind: 'execute',
  command: 'bun test',
  label: null,
  text: 'bun test',
  background: false,
})

test('a thought newer than every call of the Turn is the activity, as the Feed tail draws it', () => {
  assert.deepEqual(readActivity([PROMPT, CALL, THINKING]), {
    label: HEADLINE,
    kind: 'thought',
    open: true,
    tool: 'thought',
    target: null,
  })
})

test('a call still running outranks the Turn latest thought', () => {
  assert.equal(readActivity([PROMPT, THINKING, CALL])?.label, 'Ran bun test')
  assert.equal(readActivity([PROMPT, THINKING, CALL])?.open, true)
})

// The Codex app keeps "Reviewing agent model assignment…" over the `rtk rg` it ran under it.
test('a settled call newer than the Turn latest thought leaves the headline as the activity', () => {
  const answer: TranscriptMessage = {
    ...BASE,
    uuid: 'answer',
    role: 'user',
    blocks: [],
    toolCalls: [],
    answeredCalls: ['call-1'],
  }
  assert.equal(readActivity([PROMPT, THINKING, CALL, answer])?.label, HEADLINE)
  assert.equal(readActivity([PROMPT, CALL, answer])?.label, 'Ran bun test')
  assert.equal(readActivity([PROMPT, CALL, answer])?.open, false)
})
