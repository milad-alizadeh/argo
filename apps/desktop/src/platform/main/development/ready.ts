import { mkdir, writeFile } from 'node:fs/promises'
import { createConnection } from 'node:net'
import type { BrowserWindow } from 'electron'
import {
  type DevelopmentInstance,
  developmentReadyRecord,
} from '@/platform/main/development/instance'

export async function writeDevelopmentReady(
  instance: DevelopmentInstance | null,
  window: BrowserWindow,
): Promise<void> {
  if (!instance) return

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
}
