import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

export const LOCALLY_READY_CONFIGURATION = JSON.stringify(
  {
    version: 1,
    targets: {
      app: { default: true, path: '.', setup: 'true', run: 'true', build: 'true', test: 'true' },
    },
  },
  null,
  2,
)

export async function makeProjectLocallyReady(projectPath: string) {
  const configurationDirectory = path.join(projectPath, '.argo')
  await mkdir(configurationDirectory, { recursive: true })
  await writeFile(path.join(configurationDirectory, 'settings.json'), LOCALLY_READY_CONFIGURATION)
}
