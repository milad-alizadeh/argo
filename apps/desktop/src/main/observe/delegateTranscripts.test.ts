import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { owningTranscript, readDelegateTurns } from './delegateTranscripts'
import { NO_IMAGE_READER } from './mediaResult'

// A delegate's interior lives in files BESIDE its parent's transcript, so these read real ones.

let root: string
let transcript: string

const record = (over: Record<string, unknown>) =>
  JSON.stringify({ isSidechain: true, timestamp: '2026-07-20T14:00:00.000Z', ...over })

const PROMPT = record({
  type: 'user',
  uuid: 'd-1',
  message: { role: 'user', content: 'review the diff' },
})

const REPLY = record({
  type: 'assistant',
  uuid: 'd-2',
  message: {
    role: 'assistant',
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: 'done' }],
  },
})

function plantDelegate(name: string, meta: Record<string, unknown>, lines: string[]): void {
  const directory = join(root, 'project-a', 'session-1', 'subagents')
  mkdirSync(directory, { recursive: true })
  writeFileSync(join(directory, `${name}.meta.json`), JSON.stringify(meta))
  writeFileSync(join(directory, `${name}.jsonl`), `${lines.join('\n')}\n`)
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'argo-delegates-'))
  mkdirSync(join(root, 'project-a'), { recursive: true })
  transcript = join(root, 'project-a', 'session-1.jsonl')
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('readDelegateTurns', () => {
  it("reads a delegate's own turns, keyed by the call that spawned it", async () => {
    plantDelegate('agent-abc', { toolUseId: 'toolu_1' }, [PROMPT, REPLY])

    const delegates = await readDelegateTurns(transcript, NO_IMAGE_READER)

    expect(Object.keys(delegates)).toEqual(['toolu_1'])
    expect(delegates.toolu_1?.[0]?.prompt).toBe('review the diff')
    expect(delegates.toolu_1?.[0]?.prose).toEqual([{ kind: 'message', markdown: 'done' }])
  })

  it('leaves a transcript whose sidecar names no call unread, rather than guessing one', async () => {
    plantDelegate('agent-abc', { agentType: 'Explore' }, [PROMPT, REPLY])

    expect(await readDelegateTurns(transcript, NO_IMAGE_READER)).toEqual({})
  })

  it('is empty for a session that delegated nothing', async () => {
    expect(await readDelegateTurns(transcript, NO_IMAGE_READER)).toEqual({})
  })
})

describe('owningTranscript', () => {
  it('maps a nested delegate file to the session transcript it belongs to', () => {
    const nested = join(root, 'project-a', 'session-1', 'subagents', 'agent-abc.jsonl')
    expect(owningTranscript(root, nested)).toBe(transcript)
  })

  it('leaves a session transcript as itself', () => {
    expect(owningTranscript(root, transcript)).toBe(transcript)
  })

  it('claims nothing for a path outside the root', () => {
    expect(owningTranscript(root, join(tmpdir(), 'elsewhere', 'x.jsonl'))).toBeNull()
  })
})
