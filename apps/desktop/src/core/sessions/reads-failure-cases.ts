// Every Session read declaration, with what it answers when what it needs is not there: no
// source at all, a source without the capability it wants, and a source whose own read throws.
// `reads.test.ts` drives each row through the real Session bridge.
import assert from 'node:assert/strict'
import { managedRow } from './managed-row'
import type { SESSION_OPERATIONS } from './operations'
import type { SessionSource } from './session-source'

export type Reply = Record<string, unknown>

export const SESSION_ID = 'readOne'

function denied() {
  return Object.assign(new Error('denied'), { code: 'EACCES' })
}

// A source the reader resolves as this Session's owner without reading a file to find it, so a
// body that throws is reached rather than swallowed by the owner lookup's own catch.
export function owningSource(capabilities: Partial<SessionSource> = {}): SessionSource {
  return {
    cli: 'claude',
    discoverSessions: async () => ({
      rows: [],
      filesFound: 0,
      filesRead: 0,
      filesUnreadable: 0,
      nextCursor: null,
    }),
    readSessionFiles: async () => null,
    projectFeed: () => [],
    managedSessions: () => [
      managedRow(SESSION_ID, {
        cli: 'claude',
        cwd: '/work',
        status: 'running',
        setup: { model: null, effort: null, mode: null },
        prompt: 'Managed.',
        startedAt: '2026-09-16T09:00:00.000Z',
      }),
    ],
    ...capabilities,
  }
}

export type Declaration = {
  operation: keyof typeof SESSION_OPERATIONS
  fields: Record<string, unknown>
  // What the read answers with no source at all behind it.
  withoutSource: (reply: Reply) => void
  // What it answers when a source is there but does not have the capability this read wants.
  withoutCapability?: (reply: Reply) => void
  // A source whose own read throws a permission error.
  throwing?: Partial<SessionSource>
}

export const DECLARATIONS: Declaration[] = [
  {
    operation: 'file',
    fields: { sessionId: SESSION_ID, path: 'notes.md' },
    withoutSource: (reply) => assert.equal(reply.code, 'missing-session'),
    throwing: {
      readSessionFiles: async () => {
        throw denied()
      },
    },
  },
  {
    operation: 'skill',
    fields: { path: 'not-absolute/SKILL.md' },
    withoutSource: (reply) => {
      assert.equal(reply.type, 'session.skill.read')
      assert.equal(reply.content, null)
    },
  },
  {
    operation: 'shellOutput',
    fields: { sessionId: SESSION_ID, shellId: 'sh-call-build' },
    withoutSource: (reply) => assert.equal(reply.code, 'missing-session'),
    withoutCapability: (reply) => {
      assert.equal(reply.type, 'session.shell.output.read')
      assert.equal(reply.output, null)
    },
    throwing: {
      readShellOutput: async () => {
        throw denied()
      },
    },
  },
  {
    operation: 'delegationUsage',
    fields: { sessionId: SESSION_ID },
    withoutSource: (reply) => assert.equal(reply.code, 'missing-session'),
    withoutCapability: (reply) => {
      assert.equal(reply.type, 'session.delegation.usage.read')
      assert.deepEqual(reply.usage, [])
    },
    throwing: {
      readDelegationUsage: async () => {
        throw denied()
      },
    },
  },
]
