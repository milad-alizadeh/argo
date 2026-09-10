// Registration, refusal and relocation driven through the SHIPPED cockpit, not through the client.
// A registry the renderer never touches is the point of the slice, so every assertion here reads
// the screen and then reads the file the main process wrote.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import {
  chooseThen,
  clickMenuItem,
  deckHeading,
  deckState,
  refusal,
  stubChooser,
  subject,
  waitForDeck,
} from './cockpit-driver'

// One launch of the cockpit: the app, its window, and the fixture both are running against.
export const readStore = async (run) => JSON.parse(await readFile(run.fixture.registryPath, 'utf8'))

export async function proveRegistration(run) {
  assert.equal(await deckState(run.page), 'empty')
  await chooseThen(run, run.fixture.beta, { button: 'Open Project…', state: 'selected' })
  assert.equal(await deckHeading(run.page), 'beta')
  assert.equal(await subject(run.page), '— beta')
  const store = await readStore(run)
  const registered = store.projects.find((project) => project.path === run.fixture.beta)
  assert.equal(store.selectedId, registered.id)
  // The identity another client owns is untouched, fields included.
  assert.deepEqual(store.projects[0], {
    id: 'project-1',
    path: run.fixture.projectPath,
    bindings: [{ token: 'must-stay-private' }],
  })
  return registered.id
}

export async function proveRefusals(run, registeredId) {
  // A folder that is not a git repository registers nothing and says why.
  await chooseThen(run, run.fixture.plain, {
    button: 'Open another Project…',
    state: 'not-a-repository',
  })
  assert.equal(await refusal(run.page), 'That folder is not a git repository.')
  assert.equal((await readStore(run)).projects.length, 2)

  // Choosing a folder that is already a Project selects it rather than minting a second identity.
  await chooseThen(run, run.fixture.beta, { button: 'Open another Project…', state: 'selected' })
  const afterDuplicate = await readStore(run)
  assert.equal(afterDuplicate.projects.length, 2)
  assert.equal(afterDuplicate.selectedId, registeredId)

  // Dismissing the chooser leaves the screen and the file as they were.
  const before = await readFile(run.fixture.registryPath, 'utf8')
  await chooseThen(run, null, { button: 'Open another Project…', state: 'selected' })
  assert.equal(await readFile(run.fixture.registryPath, 'utf8'), before)
}

export async function proveRestart(run, registeredId) {
  await waitForDeck(run.page, 'selected')
  assert.equal(await deckHeading(run.page), 'beta')
  assert.equal((await readStore(run)).selectedId, registeredId)
}

// The path moved and the identity did not, which is the whole point of relocation.
async function assertRelocated(run, registeredId, folder) {
  assert.equal(await deckHeading(run.page), path.basename(folder))
  const store = await readStore(run)
  assert.equal(store.selectedId, registeredId)
  assert.equal(store.projects.find((project) => project.id === registeredId).path, folder)
  assert.equal(store.projects.length, 2)
}

// The Project was registered by an earlier launch of this same app. Its folder has moved since.
export async function proveRelocation(run, registeredId) {
  await waitForDeck(run.page, 'refused')
  assert.equal(await deckHeading(run.page), 'beta')
  assert.equal(await refusal(run.page), 'The registered Project folder is unavailable.')
  // The control on the refused deck reaches the chooser, and a folder that is no repository is
  // turned away without the Project losing its place on screen.
  await chooseThen(run, run.fixture.plain, { button: 'Locate Project…', state: 'refused' })
  assert.equal(await refusal(run.page), 'That folder is not a git repository.')
  assert.equal(await deckHeading(run.page), 'beta')
  assert.equal((await readStore(run)).projects.length, 2)
  // Open Project… means relocate while a refused Project is on screen, so the menu item cannot
  // register the moved folder as a second identity. It is the shipped menu that is clicked.
  await stubChooser(run.application, [run.fixture.moved])
  const item = await clickMenuItem(run, 'Open Project…', {
    accelerator: 'CmdOrCtrl+O',
    state: 'selected',
  })
  assert.equal(item.accelerator, item.expected)
  await assertRelocated(run, registeredId, run.fixture.moved)
}

// The same relocation, driven by the control the refused deck puts on screen rather than by the
// menu. The folder moved again between launches, so this is a second real relocation and not a
// second name for the first one.
export async function proveControlRelocation(run, registeredId) {
  await waitForDeck(run.page, 'refused')
  await chooseThen(run, run.fixture.relocated, { button: 'Locate Project…', state: 'selected' })
  await assertRelocated(run, registeredId, run.fixture.relocated)
}
