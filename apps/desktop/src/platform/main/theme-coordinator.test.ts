import { afterEach, beforeEach, expect, spyOn, test } from 'bun:test'
import { EventEmitter } from 'node:events'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { Appearance } from '@/platform/contract/appearance'
import { createThemeCoordinator } from './theme-coordinator'

class MockNativeAppearance extends EventEmitter {
  themeSource: Appearance = 'system'
  systemDark = false
  get shouldUseDarkColors() {
    return this.themeSource === 'system' ? this.systemDark : this.themeSource === 'dark'
  }
  changeSystem(dark: boolean) {
    this.systemDark = dark
    this.emit('updated')
  }
}

let root: string
let native: MockNativeAppearance
beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'argo-theme-'))
  native = new MockNativeAppearance()
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

async function saved(value: string) {
  await mkdir(path.join(root, 'portable-v1'), { recursive: true })
  await writeFile(path.join(root, 'portable-v1/appearance.json'), value)
}

test('missing preferences default to Neutral and follow System', async () => {
  native.systemDark = true
  const coordinator = await createThemeCoordinator(root, native)
  expect(coordinator.read()).toEqual({
    theme: 'neutral',
    appearance: 'system',
    dark: true,
    revision: 0,
  })
  native.changeSystem(false)
  expect(coordinator.read()).toMatchObject({ dark: false, revision: 1 })
  coordinator.dispose()
})

test('existing appearance preference remains valid and other fields survive writes', async () => {
  await saved(JSON.stringify({ appearance: 'dark', portableClient: { name: 'other' } }))
  const coordinator = await createThemeCoordinator(root, native)
  expect(coordinator.read()).toMatchObject({ theme: 'neutral', appearance: 'dark', dark: true })
  await coordinator.mutate({ theme: 'graphite', appearance: 'light' })
  expect(
    JSON.parse(await readFile(path.join(root, 'portable-v1/appearance.json'), 'utf8')),
  ).toEqual({
    theme: 'graphite',
    appearance: 'light',
    portableClient: { name: 'other' },
  })
  coordinator.dispose()
})

test.each(['{', '{"appearance":"unknown"}', '{"theme":"unknown","appearance":"dark"}'])(
  'invalid saved shape defaults safely and is reported: %s',
  async (document) => {
    await saved(document)
    const report = spyOn(console, 'error').mockImplementation(() => {})
    try {
      const coordinator = await createThemeCoordinator(root, native)
      expect(coordinator.read()).toMatchObject({ theme: 'neutral', appearance: 'system' })
      expect(report).toHaveBeenCalledTimes(1)
      coordinator.dispose()
    } finally {
      report.mockRestore()
    }
  },
)

test('rejected mutations retain accepted state and report increasing counts', async () => {
  const coordinator = await createThemeCoordinator(root, native)
  const initial = coordinator.read()
  const report = spyOn(console, 'error').mockImplementation(() => {})
  try {
    expect(await coordinator.mutate({ theme: 'unknown', appearance: 'light' })).toEqual({
      ok: false,
      reason: 'invalid',
      state: initial,
    })
    await coordinator.mutate({ theme: 'neutral', appearance: 'light', dark: true })
    expect(coordinator.read()).toBe(initial)
    expect(report.mock.calls.map(([message]) => message)).toEqual([
      'Rejected appearance value #1:',
      'Rejected appearance value #2:',
    ])
  } finally {
    report.mockRestore()
    coordinator.dispose()
  }
})

test('a failed write never changes accepted or native preference', async () => {
  const coordinator = await createThemeCoordinator(root, native)
  await writeFile(path.join(root, 'portable-v1'), 'blocks the directory')
  const initial = coordinator.read()
  expect(await coordinator.mutate({ theme: 'graphite', appearance: 'dark' })).toEqual({
    ok: false,
    reason: 'storage',
    state: initial,
  })
  expect(native.themeSource).toBe('system')
  expect(coordinator.read()).toBe(initial)
  coordinator.dispose()
})

test('serialized changes notify every listener for same-appearance identity changes', async () => {
  const coordinator = await createThemeCoordinator(root, native)
  const first: string[] = []
  const second: string[] = []
  const unsubscribe = coordinator.subscribe((state) => first.push(state.theme))
  coordinator.subscribe((state) => second.push(state.theme))
  await Promise.all([
    coordinator.mutate({ theme: 'graphite', appearance: 'light' }),
    coordinator.mutate({ theme: 'neutral', appearance: 'light' }),
  ])
  expect(first).toEqual(['graphite', 'neutral'])
  expect(second).toEqual(first)
  unsubscribe()
  native.changeSystem(true)
  expect(coordinator.read().dark).toBe(false)
  await coordinator.mutate({ theme: 'graphite', appearance: 'system' })
  expect(coordinator.read().dark).toBe(true)
  expect(first).toHaveLength(2)
  expect(second).toHaveLength(3)
  coordinator.dispose()
  expect(native.listenerCount('updated')).toBe(0)
})
