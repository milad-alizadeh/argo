import { mkdir, writeFile } from 'node:fs/promises'
import { createConnection } from 'node:net'
import type { BrowserWindow } from 'electron'
import {
  type DevelopmentInstance,
  developmentReadyRecord,
} from '@/platform/main/development/instance'

type DevelopmentReadinessFailureReporter = (message: string) => void

function writeDevelopmentReadinessFailure(message: string): void {
  process.stderr.write(`${message}\n`, () => undefined)
}

export function reportDevelopmentReadinessFailure(
  error: unknown,
  report: DevelopmentReadinessFailureReporter = writeDevelopmentReadinessFailure,
): void {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error)
  try {
    report(message)
  } catch {
    // A failed Electron process can inherit an unavailable stderr pipe.
  }
}

export async function writeDevelopmentReady(
  instance: DevelopmentInstance | null,
  window: BrowserWindow,
): Promise<void> {
  if (!instance) return

  try {
    await mkdir(instance.directory, { recursive: true })
    await new Promise<void>((resolve, reject) => {
      const socket = createConnection(instance.controlFile)
      socket.once('error', reject)
      socket.once('connect', () => socket.write(`ready ${process.pid} ${instance.controlToken}`))
      socket.once('data', (reply) => {
        if (reply.toString() === 'ready') resolve()
        else reject(new Error('Development launcher rejected Electron readiness.'))
        socket.end()
      })
    })
    await writeFile(
      instance.readyFile,
      `${JSON.stringify(developmentReadyRecord(instance, window.id), null, 2)}\n`,
      { mode: 0o600 },
    )
  } catch (error) {
    reportDevelopmentReadinessFailure(error)
    window.close()
  }
}
