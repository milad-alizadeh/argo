import { execFile } from 'node:child_process'
import { stat } from 'node:fs/promises'
import { promisify } from 'node:util'

const run = promisify(execFile)

export function runGit(arguments_: string[], options: { timeout?: number } = {}) {
  return run('git', arguments_, options)
}

export function folderPresent(folder: string): Promise<boolean> {
  return stat(folder).then(
    (found) => found.isDirectory(),
    () => false,
  )
}
