#!/usr/bin/env node
// Tests that `screenshot.sh` addresses only the Argo it launched, run via `bun run test:hooks`.
//
// The bug these pin (#885) is invisible to every other gate: the script used to quit any process
// named Argo, so a render closed the dev build the person at the machine was looking at, and
// `specimens.sh` did it once per specimen. The fix is pid scoping, and pid scoping is only
// checkable by watching which process the script talks to. The tree it talks to them in, and the
// stubs that record them, are `screenshot-scope.fixture.mjs`.
import assert from 'node:assert/strict'
import {
  check,
  isRunning,
  launched,
  launchLine,
  report,
  run,
  settled,
  startBystander,
} from './screenshot-scope.fixture.mjs'

const bystander = startBystander()
const plain = run({ ARGO_SPECIMEN: 'foundations' })

check('runs the app bundle’s own binary', () => {
  assert.equal(plain.status, 0, plain.output)
  assert.ok(launchLine(plain.calls), `the binary was never run: ${plain.output}`)
})

check('never launches through `open`, which would activate a running copy instead', () => {
  assert.deepEqual(
    plain.calls.filter((line) => line.startsWith('open ')),
    [],
  )
})

check('never reaches an Argo by name', () => {
  // `pgrep -x Argo` is how the old script found them; the quit went through `application "Argo"`.
  const named = plain.calls.filter((line) => /^pgrep |application "Argo"/.test(line))
  assert.deepEqual(named, [], 'the script still reaches an Argo by name')
})

check('passes its flags straight to the binary', () => {
  const argv = launchLine(plain.calls)
  assert.match(argv, /--project /)
  assert.match(argv, /--specimen foundations/)
  assert.doesNotMatch(argv, /--args/)
})

check('identifies the window by the pid it launched', () => {
  const pid = launched(plain.calls)
  assert.ok(
    plain.calls.includes(`swift scripts/WindowID.swift ${pid}`),
    `WindowID was not asked about pid ${pid}: ${plain.calls.join(' | ')}`,
  )
})

check('closes the instance it launched', () => {
  assert.ok(settled(launched(plain.calls)), 'the launched app was left running')
})

check('leaves an Argo it did not launch running', () => {
  // #885 itself: the bystander stands for the dev build somebody is looking at.
  assert.ok(isRunning(bystander), 'the render closed an Argo it did not launch')
  process.kill(bystander)
})

check('resizes by unix id rather than by process name', () => {
  const sized = run({ ARGO_WINDOW_SIZE: '680x600' })
  assert.equal(sized.status, 0, sized.output)
  const resize = sized.calls.find((line) => /set size of front window/.test(line))
  assert.ok(resize, `no resize was attempted: ${sized.calls.join(' | ')}`)
  assert.match(resize, new RegExp(`unix id is ${launched(sized.calls)}\\b`))
  assert.match(resize, /\{680, 600\}/)
})

const kept = run({ ARGO_KEEP_RUNNING: '1' })

check('ARGO_KEEP_RUNNING leaves the app up', () => {
  assert.equal(kept.status, 0, kept.output)
  assert.ok(isRunning(launched(kept.calls)), 'the app was closed despite ARGO_KEEP_RUNNING')
})

check('hands the caller back its shell even so', () => {
  // The app is a child of the script rather than detached by `open`, so it would inherit the
  // caller's stdout — and a run leaving it up would then hang for as long as the app lived.
  // `run` having returned at all, with the app still up, is the check.
  assert.notEqual(kept.status, null, 'the script never returned while the app was up')
  process.kill(Number(launched(kept.calls)))
})

check('a window that never appears fails the render', () => {
  const blind = run({ STUB_NO_WINDOW: '1' })
  assert.equal(blind.status, 1, blind.output)
  assert.match(blind.output, /no window/)
  assert.ok(settled(launched(blind.calls)), 'a failed render orphaned its instance')
})

check('a capture that fails closes the instance too', () => {
  // The step most likely to fail on a fresh machine — Screen Recording is not granted — and the
  // one the launch and the quit no longer bracket on their own.
  const broken = run({ STUB_CAPTURE_FAILS: '1' })
  assert.notEqual(broken.status, 0, 'a failed capture reported success')
  assert.ok(settled(launched(broken.calls)), 'a failed capture orphaned its instance')
})

report('screenshot scoping')
