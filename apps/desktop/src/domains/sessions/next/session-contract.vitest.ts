import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, expect, test } from 'vitest'
import {
  capabilitiesFor,
  HARNESSES,
  sessionCommandSchema,
  sessionIdentitySchema,
  sessionProjectionSchema,
} from '@/domains/sessions/next/contract/session-contract'
import { createSessionService } from '@/domains/sessions/next/main/session-service'

const folders: string[] = []

afterEach(async () => {
  await Promise.all(folders.splice(0).map((folder) => rm(folder, { recursive: true, force: true })))
})

test('keeps native Session IDs separate by Harness', () => {
  const claude = sessionIdentitySchema.parse({ harness: 'claude', nativeId: 'shared' })
  const codex = sessionIdentitySchema.parse({ harness: 'codex', nativeId: 'shared' })

  expect(claude).not.toEqual(codex)
})

test('leases equal native Session IDs independently for each Harness', async () => {
  const harness = await serviceHarness()
  try {
    expect(harness.service('window-a').acquire({ harness: 'claude', nativeId: 'shared' })).toEqual({
      posture: 'managed',
    })
    expect(harness.service('window-b').acquire({ harness: 'codex', nativeId: 'shared' })).toEqual({
      posture: 'managed',
    })
  } finally {
    harness.close()
  }
})

test('rejects malformed product commands at the Session boundary', () => {
  expect(
    sessionCommandSchema.safeParse({
      type: 'session.send',
      session: { harness: 'claude', nativeId: '' },
      prompt: 'Continue the work.',
    }).success,
  ).toBe(false)
  expect(
    sessionCommandSchema.safeParse({
      type: 'session.send',
      session: { harness: 'claude', nativeId: 'native-1' },
      prompt: '   ',
    }).success,
  ).toBe(false)
  expect(
    sessionCommandSchema.safeParse({
      type: 'session.start',
      harness: 'unknown',
      cwd: '',
      prompt: 'Start.',
    }).success,
  ).toBe(false)
  expect(
    sessionCommandSchema.safeParse({
      type: 'session.interrupt',
      session: { harness: 'codex', nativeId: 'native-1' },
      unexpected: true,
    }).success,
  ).toBe(false)
  expect(
    sessionProjectionSchema.safeParse({
      session: { harness: 'claude', nativeId: 'native-1' },
      posture: 'managed',
      sourceHealth: 'unknown',
      revision: -1,
    }).success,
  ).toBe(false)
})

test('maps every capability for every supported Harness', () => {
  expect(
    Object.fromEntries(HARNESSES.map((harness) => [harness, capabilitiesFor(harness)])),
  ).toEqual({
    claude: { start: true, send: true, interrupt: true },
    codex: { start: true, send: true, interrupt: true },
  })
})

async function serviceHarness() {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'argo-session-service-'))
  folders.push(folder)
  const database = new DatabaseSync(path.join(folder, 'argo.sqlite'))
  return {
    close: () => database.close(),
    service: (windowId: string) =>
      createSessionService({ database, windowId, now: () => 100, leaseDurationMs: 10 }),
  }
}

test('prevents another Argo window from acquiring a managed Session lease', async () => {
  const harness = await serviceHarness()
  try {
    const session = { harness: 'claude' as const, nativeId: 'native-1' }

    expect(harness.service('window-a').acquire(session)).toEqual({ posture: 'managed' })
    expect(harness.service('window-b').acquire(session)).toEqual({ posture: 'watched' })
  } finally {
    harness.close()
  }
})

test('releases a managed Session lease for another Argo window', async () => {
  const harness = await serviceHarness()
  try {
    const session = { harness: 'codex' as const, nativeId: 'native-1' }
    const first = harness.service('window-a')

    first.acquire(session)
    first.release(session)

    expect(harness.service('window-b').acquire(session)).toEqual({ posture: 'managed' })
  } finally {
    harness.close()
  }
})

test('renews only the managed Session lease this window owns', async () => {
  const harness = await serviceHarness()
  try {
    const session = { harness: 'claude' as const, nativeId: 'native-1' }
    const first = harness.service('window-a')

    first.acquire(session)

    expect(first.renew(session)).toEqual({ posture: 'managed' })
    expect(harness.service('window-b').renew(session)).toEqual({ posture: 'watched' })
  } finally {
    harness.close()
  }
})

test('rejects an invalid Session identity at the service boundary', async () => {
  const harness = await serviceHarness()
  try {
    expect(() =>
      harness.service('window-a').acquire({ harness: 'claude', nativeId: '' } as never),
    ).toThrow()
  } finally {
    harness.close()
  }
})
