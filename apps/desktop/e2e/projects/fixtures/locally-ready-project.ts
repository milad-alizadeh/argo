import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const LOCALLY_READY_CONFIGURATION = [
  'version = 1',
  '',
  '[targets.app]',
  'default = true',
  'path = "."',
  'setup = "true"',
  'run = "true"',
  'build = "true"',
  'test = "true"',
  '',
].join('\n')

// A selected Project opens only after its commands validate.
export async function makeProjectLocallyReady(projectPath: string) {
  const configurationDirectory = path.join(projectPath, '.argo')
  await mkdir(configurationDirectory, { recursive: true })
  await writeFile(path.join(configurationDirectory, 'settings.toml'), LOCALLY_READY_CONFIGURATION)
}
