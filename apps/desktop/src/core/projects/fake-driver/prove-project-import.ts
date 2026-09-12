import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { COMMAND_CHANNEL } from '../../commands/shortcuts'
import { PROJECT_IMPORT_ACTION } from '../messages'

const importRequest = { version: 1, type: PROJECT_IMPORT_ACTION, requestId: 'import-1' }

export async function proveProjectImport({ application, page, fixture, invoke, request }) {
  const sourceBefore = await readFile(fixture.sourceRegistryPath, 'utf8')
  assert.equal((await invoke(request)).code, 'storage-unavailable')
  await page
    .getByRole('button', { name: 'Import existing Projects', exact: true })
    .dispatchEvent('click')
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-component="ProjectDeck"] [data-state]')
        ?.getAttribute('data-state') === 'selected',
  )
  assert.equal(
    await page
      .locator('[data-component="CockpitShell"] [data-component="ProjectRefusal"]')
      .getByText('Projects imported. Accounts are still waiting to be imported.', { exact: true })
      .isVisible(),
    true,
  )
  const repeated = await page.evaluate((message) => window.argo.importProjects(message), {
    ...importRequest,
    requestId: 'import-2',
  })
  assert.equal(repeated.importedCount, 0)
  assert.equal(await readFile(fixture.sourceRegistryPath, 'utf8'), sourceBefore)
  await writeFile(
    fixture.sourceRegistryPath,
    JSON.stringify({
      projects: [{ id: 'project-1', path: path.join(fixture.userData, 'moved') }],
      activeProjectId: 'project-1',
    }),
  )
  await application.evaluate(
    ({ BrowserWindow }, message) => {
      BrowserWindow.getAllWindows()[0].webContents.send(message.channel, message.command)
    },
    { channel: COMMAND_CHANNEL, command: importRequest.type },
  )
  const refusal = page
    .locator('[data-component="CockpitShell"] [data-component="ProjectRefusal"]')
    .getByText('Argo needs your decision before it imports these Projects.', { exact: true })
  await refusal.waitFor()
  assert.equal(await refusal.isVisible(), true)
  assert.equal((await invoke(request)).type, 'project.opened')
}
