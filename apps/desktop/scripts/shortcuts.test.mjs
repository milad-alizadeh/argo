import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DESTINATIONS,
  matchesChord,
  menuAccelerators,
  menuTemplate,
  navigateCommand,
  REGISTER_PROJECT_COMMAND,
  SHORTCUTS,
} from '../src/shortcuts.ts'

const pressed = (key, modifiers = {}) => ({
  key,
  meta: false,
  ctrl: false,
  shift: false,
  alt: false,
  ...modifiers,
})

test('no chord is declared twice', () => {
  const chords = SHORTCUTS.map((entry) => entry.chord)
  assert.deepEqual([...new Set(chords)], chords)
})

test('no command is declared twice', () => {
  const commands = SHORTCUTS.map((entry) => entry.command)
  assert.deepEqual([...new Set(commands)], commands)
})

test('every built menu accelerator comes from the table', () => {
  const declared = new Set(SHORTCUTS.map((entry) => entry.chord))
  const built = menuAccelerators(menuTemplate())
  assert.equal(built.length > 0, true)
  for (const accelerator of built) assert.equal(declared.has(accelerator), true)
})

test('every working surface has a first-screen chord', () => {
  for (const destination of DESTINATIONS) {
    const found = SHORTCUTS.find((entry) => entry.command === navigateCommand(destination))
    assert.equal(found?.scope, 'window')
  }
})

test('registration is reachable from the menu', () => {
  const found = SHORTCUTS.find((entry) => entry.command === REGISTER_PROJECT_COMMAND)
  assert.deepEqual(
    { chord: found?.chord, scope: found?.scope },
    {
      chord: 'CmdOrCtrl+O',
      scope: 'menu',
    },
  )
})

test('a chord matches on either platform modifier', () => {
  assert.equal(matchesChord('CmdOrCtrl+1', pressed('1', { meta: true })), true)
  assert.equal(matchesChord('CmdOrCtrl+1', pressed('1', { ctrl: true })), true)
})

test('a chord refuses a modifier it does not name', () => {
  assert.equal(matchesChord('CmdOrCtrl+1', pressed('1', { meta: true, shift: true })), false)
  assert.equal(matchesChord('CmdOrCtrl+1', pressed('1', { meta: true, alt: true })), false)
  assert.equal(matchesChord('CmdOrCtrl+1', pressed('1')), false)
})

test('a chord refuses another key', () => {
  assert.equal(matchesChord('CmdOrCtrl+1', pressed('2', { meta: true })), false)
})
