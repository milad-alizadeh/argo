import type { ChildProcess } from 'node:child_process'

function absentProcess(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as NodeJS.ErrnoException).code === 'ESRCH'
  )
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

export async function stopElectronProcess(processId: number | undefined): Promise<void> {
  if (!processId) return
  try {
    process.kill(processId, 'SIGTERM')
  } catch (error) {
    if (!absentProcess(error)) throw error
  }

  const deadline = Date.now() + 5_000
  while (true) {
    try {
      process.kill(processId, 0)
    } catch (error) {
      if (absentProcess(error)) return
      throw error
    }
    if (Date.now() >= deadline) throw new Error('Recorded Electron process did not exit.')
    await delay(50)
  }
}

export function stopForgeProcess(child: ChildProcess): void {
  if (process.platform === 'win32' || !child.pid) {
    child.kill('SIGTERM')
    return
  }
  process.kill(-child.pid, 'SIGTERM')
}
