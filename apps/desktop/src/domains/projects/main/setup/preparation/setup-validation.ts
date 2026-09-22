import { spawn } from 'node:child_process'
import path from 'node:path'
import { parseProjectConfiguration, readProjectConfiguration } from '../../project-configuration'

const COMMAND_TIMEOUT_MS = 30_000
const RUN_COMMAND_GRACE_MS = 2_000

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
  const commands = [
    { command: target.setup, longRunning: false },
    { command: target.run, longRunning: true },
    { command: target.build, longRunning: false },
    { command: target.test, longRunning: false },
  ]
  for (const { command, longRunning } of commands) {
    if (!(await runCommand(command, directory, longRunning))) return false
  }
  return true
}

// A run command starts a server, so it passes when it is still alive after the grace period.
function runCommand(command: string, directory: string, longRunning: boolean): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn('/bin/sh', ['-lc', command], {
      cwd: directory,
      detached: true,
      stdio: 'ignore',
    })
    const timer = setTimeout(
      () => {
        if (child.pid !== undefined) process.kill(-child.pid, 'SIGTERM')
        resolve(longRunning)
      },
      longRunning ? RUN_COMMAND_GRACE_MS : COMMAND_TIMEOUT_MS,
    )
    child.on('error', () => {
      clearTimeout(timer)
      resolve(false)
    })
    child.on('exit', (code) => {
      clearTimeout(timer)
      resolve(code === 0)
    })
  })
}
