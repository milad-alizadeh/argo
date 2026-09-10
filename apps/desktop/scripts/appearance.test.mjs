import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  APPEARANCES,
  createAppearanceClient,
  DEFAULT_APPEARANCE,
  isAppearanceState,
  windowBackground,
} from '../src/appearance/appearance.ts'

const client = (invoke) => createAppearanceClient(invoke, () => {})

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
  const sent = []
  const resolved = { appearance: 'light', dark: false }
  const surface = client((appearance) => {
    sent.push(appearance)
    return Promise.resolve(resolved)
  })
  assert.deepEqual(await surface.setAppearance('light'), resolved)
  assert.deepEqual(sent, ['light'])
})

test('an appearance the contract does not name is never sent', async () => {
  const sent = []
  const surface = client((appearance) => {
    sent.push(appearance)
    return Promise.resolve({ appearance: 'system', dark: true })
  })
  await surface.setAppearance('sepia')
  assert.deepEqual(sent, [null])
})

test('a changed appearance reaches the listener only when it is one', () => {
  const seen = []
  let push = () => {}
  createAppearanceClient(
    () => Promise.resolve(null),
    (listener) => {
      push = listener
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
