// One failure table over every Session read declaration (#2280), driven through the real Session
// bridge: the version check and the schema parse are proved where they now happen — at the
// operation table, once — and not inside any handler. The table itself is in
// `reads-failure-cases.ts`, which also keeps it under the type checker that this file, for its
// Electron stand-in, sits outside.

import { mock } from 'bun:test'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { electronStandIn } from '../contract/electron-stand-in'
import { createFakeIpcWindow, RENDERER_URL } from '../contract/test-support'
import { SESSION_OPERATIONS } from './operations'
import { createSessionReader } from './reader'
import { DECLARATIONS, type Declaration, owningSource, type Reply } from './reads-failure-cases'
import type { SessionSource } from './session-source'

// The Session bridge opens the attachment chooser over Electron's `dialog`, which no read
// reaches. The stand-in goes in before the bridge is imported, as a static import would resolve
// the real `electron` package first.
mock.module('electron', () => electronStandIn)
const { attachSessionBridge } = await import('./bridge')

function invoking(sources: SessionSource[]) {
  const fake = createFakeIpcWindow()
  attachSessionBridge(fake.window, {
    adapters: {},
    reader: createSessionReader(sources),
    rendererURL: RENDERER_URL,
  })
  return async (declaration: Declaration, overrides: Record<string, unknown> = {}) => {
    const operation = SESSION_OPERATIONS[declaration.operation]
    const request = {
      version: 1,
      type: operation.name,
      requestId: 'read-1',
      ...declaration.fields,
      ...overrides,
    }
    return (await fake.trustedInvoke(operation.channel, request)) as Reply
  }
}

test('refuses a contract version no read speaks', async () => {
  const invoke = invoking([owningSource()])
  for (const declaration of DECLARATIONS) {
    const reply = await invoke(declaration, { version: 2 })
    assert.equal(reply.code, 'unsupported-version', declaration.operation)
  }
})

test('refuses a request no read can parse', async () => {
  const invoke = invoking([owningSource()])
  for (const declaration of DECLARATIONS) {
    const reply = await invoke(declaration, { stray: 'field' })
    assert.equal(reply.code, 'invalid-request', declaration.operation)
  }
})

test('answers with its own degrade when no source stands behind the read', async () => {
  const invoke = invoking([])
  for (const declaration of DECLARATIONS) {
    declaration.withoutSource(await invoke(declaration))
  }
})

test('answers with its own degrade when the source has no such capability', async () => {
  const invoke = invoking([owningSource()])
  for (const declaration of DECLARATIONS) {
    declaration.withoutCapability?.(await invoke(declaration))
  }
})

test("names a read that threw in the contract's own words", async () => {
  for (const declaration of DECLARATIONS) {
    if (declaration.throwing === undefined) continue
    const invoke = invoking([owningSource(declaration.throwing)])
    const reply = await invoke(declaration)
    assert.equal(reply.code, 'access-denied', declaration.operation)
  }
})
