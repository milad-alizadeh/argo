import { execFile } from 'node:child_process'

export function executableVersion(executablePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      executablePath,
      ['--version'],
      { encoding: 'utf8', timeout: 3_000 },
      (error, stdout) => {
        if (error !== null) reject(error)
        else resolve(stdout.trim())
      },
    )
  })
}
