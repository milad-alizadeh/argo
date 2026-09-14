// Proves the drive router's owner routing (#2030) with both real adapters and the real reader
// owner lookup, one Claude Session and one Codex Session open at the same time. Neither Session
// has written a transcript, so only the managed report each driver holds can answer `ownerCliFor`.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createClaudeDriveAdapter } from '../../agents/claude/drive/session-drive-adapter'
import { claudeSessionSource } from '../../agents/claude/sessions/read-sessions'
import { createCodexDriveAdapter } from '../../agents/codex/drive/session-drive-adapter'
import { codexSessionSource } from '../../agents/codex/sessions/read-sessions'
import { compactSession, sendSession } from './drive'
import { managedRow } from './managed-row'
import { createSessionReader } from './reader'
import { tempRoot } from './reader-test-helpers'
import type { SessionDriveAdapters } from './session-drive-adapter'

const setup = { model: null, effort: null, mode: null } as const

function fakeClaudeDriver() {
  const sent: Array<{ sessionId: string; prompt: string }> = []
  return {
    sent,
    driver: {
      start: () => 'claude-1',
      compact: async (_sessionId: string) => {},
      completeCompaction: () => {},
      send: async (sessionId: string, turn: { prompt: string }) => {
        sent.push({ sessionId, prompt: turn.prompt })
      },
      interrupt: () => {},
      pendingPermission: () => null,
      decidePermission: () => true,
      decideQuestion: async () => true,
      rename: async () => 'Renamed.',
      liveMessages: () => [],
      roster: () => [],
      orphans: () => new Set<string>(),
      close: () => {},
    },
  }
}

function fakeCodexDriver() {
  const sent: Array<{ sessionId: string; prompt: string }> = []
  return {
    sent,
    driver: {
      start: async () => 'codex-1',
      send: async ({ sessionId, text }: { sessionId: string; text: string }) => {
        sent.push({ sessionId, prompt: text })
      },
      interrupt: async () => {},
      rename: async () => 'Renamed.',
      roster: () => [],
      liveMessages: () => [],
      close: () => {},
    },
  }
}

async function readerWithBothManagedSessions(context: Parameters<typeof tempRoot>[0]) {
  return createSessionReader([
    claudeSessionSource({
      transcripts: await tempRoot(context),
      managedSessions: () => [
        managedRow('claude-1', {
          cli: 'claude',
          cwd: '/proj',
          status: 'running',
          setup,
          prompt: 'Claude opener.',
          startedAt: '2026-09-14T09:00:00.000Z',
        }),
      ],
    }),
    codexSessionSource(await tempRoot(context), {
      roster: () => [
        managedRow('codex-1', {
          cli: 'codex',
          cwd: '/proj',
          status: 'running',
          setup,
          prompt: 'Codex opener.',
          startedAt: '2026-09-14T09:00:00.000Z',
        }),
      ],
    }),
  ])
}

test('routes a send to only the adapter that owns the Session, with a Claude and a Codex Session open at once', async (context) => {
  const claude = fakeClaudeDriver()
  const codex = fakeCodexDriver()
  const reader = await readerWithBothManagedSessions(context)
  const adapters: SessionDriveAdapters = {
    claude: createClaudeDriveAdapter(claude.driver),
    codex: createCodexDriveAdapter(codex.driver),
  }

  const claudeReply = await sendSession(
    {
      version: 1,
      type: 'session.send',
      requestId: 'send-claude',
      sessionId: 'claude-1',
      prompt: 'To Claude.',
      setup: { model: 'sonnet', effort: 'medium', mode: 'manual' },
    },
    { adapters, ownerCliFor: reader.ownerCliFor },
  )
  const codexReply = await sendSession(
    {
      version: 1,
      type: 'session.send',
      requestId: 'send-codex',
      sessionId: 'codex-1',
      prompt: 'To Codex.',
    },
    { adapters, ownerCliFor: reader.ownerCliFor },
  )

  assert.equal(claudeReply.type, 'session.accepted')
  assert.equal(codexReply.type, 'session.accepted')
  assert.deepEqual(claude.sent, [{ sessionId: 'claude-1', prompt: 'To Claude.' }])
  assert.deepEqual(codex.sent, [{ sessionId: 'codex-1', prompt: 'To Codex.' }])
})

test('routes compaction to its Claude Session owner', async (context) => {
  const compacted: string[] = []
  const claude = fakeClaudeDriver()
  claude.driver.compact = async (sessionId: string) => void compacted.push(sessionId)
  const codex = fakeCodexDriver()
  const reader = await readerWithBothManagedSessions(context)
  const adapters: SessionDriveAdapters = {
    claude: createClaudeDriveAdapter(claude.driver),
    codex: createCodexDriveAdapter(codex.driver),
  }

  const reply = await compactSession(
    { version: 1, type: 'session.compact', requestId: 'compact-claude', sessionId: 'claude-1' },
    { adapters, ownerCliFor: reader.ownerCliFor },
  )

  assert.equal(reply.type, 'session.accepted')
  assert.deepEqual(compacted, ['claude-1'])
})
