import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createAppearanceClient } from '../preload/appearance'
import {
  APPEARANCE_OPERATIONS,
  APPEARANCES,
  DEFAULT_APPEARANCE,
  isAppearanceState,
  windowBackground,
} from './appearance'

const state = (requestId: string, appearance = 'system', dark = true) => ({
  version: 1,
  type: 'appearance.state',
  requestId,
  appearance,
  dark,
})

function client(invoke: (channel: string, request: unknown) => Promise<unknown>) {
  return createAppearanceClient(invoke, () => () => {})
}

test('the three appearances are System, Light and Dark, and System is the default', () => {
  assert.deepEqual([...APPEARANCES], ['system', 'light', 'dark'])
  assert.equal(DEFAULT_APPEARANCE, 'system')
})

test('a window that cannot read its appearance still draws a dark one', async () => {
  const fallback = { appearance: 'system', dark: true }
  assert.deepEqual(
    await client(() => Promise.reject(new Error('no bridge'))).getAppearance(),
    fallback,
  )
  assert.deepEqual(
    await client(() => Promise.resolve({ nonsense: true })).getAppearance(),
    fallback,
  )
})

test('choosing an appearance sends it and answers with what the main process resolved', async () => {
  const sent: Array<{ channel: string; request: unknown }> = []
  const surface = client((channel, request) => {
    sent.push({ channel, request })
    const requestId = (request as { requestId: string }).requestId
    return Promise.resolve(state(requestId, 'light', false))
  })
  assert.deepEqual(await surface.setAppearance('light'), { appearance: 'light', dark: false })
  const [call] = sent
  assert.ok(call)
  assert.equal(call.channel, APPEARANCE_OPERATIONS.set.channel)
  assert.equal((call.request as { appearance: string }).appearance, 'light')
})

test('an appearance the contract does not name is never sent', async () => {
  const sent: string[] = []
  const surface = client((channel, request) => {
    sent.push(channel)
    const requestId = (request as { requestId: string }).requestId
    return Promise.resolve(state(requestId))
  })
  await surface.setAppearance('sepia' as never)
  assert.equal(sent[0], APPEARANCE_OPERATIONS.get.channel)
})

test('a changed appearance reaches the listener only when it is one', () => {
  const seen: unknown[] = []
  let push: (state: unknown) => void = () => {}
  createAppearanceClient(
    () => Promise.resolve(null),
    (listener) => {
      push = listener
      return () => {}
    },
  ).onAppearanceChanged((state) => seen.push(state))
  push({ appearance: 'dark', dark: true })
  push({ appearance: 'nonsense', dark: true })
  assert.deepEqual(seen, [{ appearance: 'dark', dark: true }])
})

test('the window ground mirrors the background token in both appearances', () => {
  assert.equal(windowBackground(true), '#0a0a0a')
  assert.equal(windowBackground(false), '#ffffff')
})

test('a state is only a state with both halves', () => {
  assert.equal(isAppearanceState({ appearance: 'system', dark: true }), true)
  assert.equal(isAppearanceState({ appearance: 'system' }), false)
  assert.equal(isAppearanceState(null), false)
})

test('an untrusted set is refused, not swallowed as a state', async () => {
  const surface = client((_channel, request) => {
    const requestId = (request as { requestId: string }).requestId
    return Promise.resolve({
      version: 1,
      type: 'appearance.error',
      requestId,
      code: 'access-denied',
      message: 'Argo cannot change the appearance from here.',
    })
  })
  assert.deepEqual(await surface.setAppearance('light'), { appearance: 'system', dark: true })
})
