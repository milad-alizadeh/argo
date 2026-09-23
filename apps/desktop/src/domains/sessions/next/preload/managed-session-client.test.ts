import { expect, test } from 'bun:test'
import { createManagedSessionClient } from '@/domains/sessions/next/preload/managed-session-client'

const start = {
  type: 'session.start' as const,
  harness: 'claude' as const,
  prompt: 'Hello',
  workspace: { kind: 'main' as const },
}

test('turns a dropped IPC reply into an uncertain command outcome', async () => {
  const client = createManagedSessionClient(async () => {
    throw new Error('connection lost')
  })

  await expect(client.executeManagedSessionCommand(start)).resolves.toEqual({ kind: 'uncertain' })
})

test('returns the adapter outcome without rewriting it', async () => {
  const client = createManagedSessionClient(async (_channel, request) => ({
    version: 1,
    type: 'managed-session.outcome',
    requestId: (request as { requestId: string }).requestId,
    outcome: { kind: 'rejected', reason: 'The Session is watched elsewhere.' },
  }))

  await expect(client.executeManagedSessionCommand(start)).resolves.toEqual({
    kind: 'rejected',
    reason: 'The Session is watched elsewhere.',
  })
})

test('reads the validated Codex catalog from the main process', async () => {
  const catalog = {
    data: [
      {
        id: 'gpt-live',
        model: 'gpt-live',
        displayName: 'Live model',
        description: 'Advertised by app-server',
        defaultReasoningEffort: 'focused',
        isDefault: true,
        hidden: false,
        supportedReasoningEfforts: [{ reasoningEffort: 'focused', description: 'Focused' }],
      },
    ],
    nextCursor: null,
  }
  const client = createManagedSessionClient(async (_channel, request) => ({
    version: 1,
    type: 'managed-session.catalog.result',
    requestId: (request as { requestId: string }).requestId,
    catalog,
  }))
  await expect(client.readCodexModelCatalog()).resolves.toEqual(catalog)
})
