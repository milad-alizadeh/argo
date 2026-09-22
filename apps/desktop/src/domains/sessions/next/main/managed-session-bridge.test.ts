import { mock } from 'bun:test'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { SessionAdapter } from '@/domains/sessions/next/contract/session-projection-contract'
import { MANAGED_SESSION_OPERATIONS } from '@/domains/sessions/next/ipc/managed-session-operations'
import type { SessionAdapterRegistry } from '@/domains/sessions/next/main/session-adapter-registry'
import { electronStandIn } from '@/platform/main/testing/electron-stand-in'
import { createMockIpcWindow, RENDERER_URL } from '../../../../../mocks/contract/mock-ipc-window'

mock.module('electron', () => electronStandIn)
const { attachManagedSessionBridge } = await import('./managed-session-bridge')

function adapterRegistry(adapter: SessionAdapter | undefined): SessionAdapterRegistry {
  return { adapterFor: () => adapter, close: () => {} }
}

test('executes a validated command through its harness adapter', async () => {
  const ipc = createMockIpcWindow()
  const adapter: SessionAdapter = {
    execute: async () => ({ kind: 'uncertain' }),
    subscribe: () => () => {},
  }
  attachManagedSessionBridge(ipc.window, {
    adapters: adapterRegistry(adapter),
    rendererURL: RENDERER_URL,
  })
  const reply = await ipc.trustedInvoke(MANAGED_SESSION_OPERATIONS.command.channel, {
    version: 1,
    type: 'managed-session.command',
    requestId: 'request-1',
    command: {
      type: 'session.start',
      harness: 'claude',
      prompt: 'Hello',
      workspace: { kind: 'main' },
    },
  })
  assert.deepEqual(reply, {
    version: 1,
    type: 'managed-session.outcome',
    requestId: 'request-1',
    outcome: { kind: 'uncertain' },
  })
})

test('rejects a command when its harness adapter is unavailable', async () => {
  const ipc = createMockIpcWindow()
  attachManagedSessionBridge(ipc.window, {
    adapters: adapterRegistry(undefined),
    rendererURL: RENDERER_URL,
  })
  const reply = await ipc.trustedInvoke(MANAGED_SESSION_OPERATIONS.command.channel, {
    version: 1,
    type: 'managed-session.command',
    requestId: 'request-1',
    command: {
      type: 'session.start',
      harness: 'claude',
      prompt: 'Hello',
      workspace: { kind: 'main' },
    },
  })
  assert.deepEqual(reply, {
    version: 1,
    type: 'managed-session.outcome',
    requestId: 'request-1',
    outcome: { kind: 'rejected', reason: 'This Session Harness is unavailable.' },
  })
})
