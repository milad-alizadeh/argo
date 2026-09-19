import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'
import {
  parseProjectConfiguration,
  readProjectConfiguration,
} from '@/domains/projects/main/project-configuration'

const run = promisify(execFile)
const COMMAND_TIMEOUT_MS = 30_000

export async function validateProjectConfiguration(
  projectPath: string,
  source?: string,
): Promise<boolean> {
  const configuration =
    source === undefined
      ? await readProjectConfiguration(projectPath)
      : parseProjectConfiguration(source)
  const target = configuration?.targets.find(({ default: isDefault }) => isDefault)
  if (!target) return false
  const directory = path.resolve(projectPath, target.path)
  for (const command of [target.setup, target.run, target.build, target.test]) {
    if (!(await runCommand(command, directory))) return false
  }
  return true
}

async function runCommand(command: string, directory: string): Promise<boolean> {
  try {
    await run('/bin/sh', ['-lc', command], { cwd: directory, timeout: COMMAND_TIMEOUT_MS })
    return true
  } catch {
    return false
  }
}
