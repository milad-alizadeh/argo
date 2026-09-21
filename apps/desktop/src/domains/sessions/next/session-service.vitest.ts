import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, test } from 'vitest'
import { createSessionService } from '@/domains/sessions/next/main/session-service'
import { createDurableDatabase } from '@/platform/main/storage/durable-database'
import { databaseMigrationsFolder } from '@/platform/main/storage/migrations-folder'
import { openSharedDatabase } from '@/platform/main/storage/shared-database'

const folders: string[] = []

afterEach(async () => {
  await Promise.all(folders.splice(0).map((folder) => rm(folder, { recursive: true, force: true })))
})

async function serviceHarness() {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'argo-session-service-'))
  folders.push(folder)
  const client = openSharedDatabase(folder, databaseMigrationsFolder())
  const database = createDurableDatabase(client)
  let now = 100
  return {
    close: () => client.close(),
    setNow: (value: number) => {
      now = value
    },
    service: (windowId: string) =>
      createSessionService({ database, windowId, now: () => now, leaseDurationMs: 10 }),
  }
}

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

test('acquires an expired managed Session lease for another Argo window', async () => {
  const harness = await serviceHarness()
  try {
    const session = { harness: 'codex' as const, nativeId: 'native-1' }

    expect(harness.service('window-a').acquire(session)).toEqual({ posture: 'managed' })
    harness.setNow(110)

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
