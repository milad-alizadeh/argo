import { expect, test } from 'bun:test'
import { initTRPC } from '@trpc/server'
import type { HarnessReadinessRegistration } from './harness-readiness-registration'
import {
  createHarnessSignInProcedureContext,
  harnessSignInProcedures,
} from './harness-sign-in-procedures'

const registration: HarnessReadinessRegistration = {
  harness: 'claude',
  checkReadiness: async () => ({ harness: 'claude', state: 'ready', detail: null }),
  signIn: {
    login: async () => 'completed',
    checkReadiness: async () => ({ harness: 'claude', state: 'ready', detail: null }),
  },
}

function caller() {
  const t = initTRPC.create()
  const context = createHarnessSignInProcedureContext([registration])
  return t.router(harnessSignInProcedures(context)).createCaller({})
}

test('validates and serves Harness readiness through tRPC', async () => {
  const reply = await caller().harnessReadinessList()
  expect(reply.type).toBe('harness-readiness.listed')
  if (reply.type === 'harness-readiness.listed') {
    expect(reply.harnesses).toEqual([{ harness: 'claude', state: 'ready', detail: null }])
  }
})

test('keeps a Harness sign-in attempt behind the procedure context', async () => {
  const procedures = caller()
  const started = await procedures.harnessSignInStart({ harness: 'claude' })
  expect(started.type).toBe('harness-sign-in.started')
  const resolved = await procedures.harnessSignInWait({ harness: 'claude' })
  expect(resolved.type).toBe('harness-sign-in.resolved')
  if (resolved.type === 'harness-sign-in.resolved') expect(resolved.status).toBe('ready')
})

test('refuses an unknown Harness before a sign-in starts', async () => {
  await expect(caller().harnessSignInStart({ harness: 'unknown' as 'claude' })).rejects.toThrow()
})
