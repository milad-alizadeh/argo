import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import type { BrowserWindow } from 'electron'
import type { DevelopmentInstance } from './instance'
import { reportDevelopmentReadinessFailure, writeDevelopmentReady } from './ready'

function developmentInstance(directory: string): DevelopmentInstance {
  return {
    controlFile: path.join(directory, 'control.sock'),
    controlTokenFile: path.join(directory, 'control-token'),
    controlToken: 'control-token',
    debugPort: 45174,
    directory,
    id: 'ticket-2484-a1b2c3d4',
    label: '#2484',
    launcherPid: 42,
    port: 45173,
    readyFile: path.join(directory, 'ready.json'),
    title: 'Argo dev · #2484 · :45173',
    userData: path.join(directory, 'user-data'),
    worktree: path.join(path.sep, 'worktrees', 'ticket-2484'),
  }
}

test('closes the window when the development launcher rejects readiness', async (context) => {
  const directory = await mkdtemp(
    path.join(path.parse(os.tmpdir()).root, 'tmp', 'argo-development-ready-'),
  )
  context.after(() => rm(directory, { recursive: true, force: true }))
  const development = developmentInstance(directory)
  const server = createServer((socket) => {
    socket.once('data', () => socket.end('rejected'))
  })
  context.after(() => server.close())
  await new Promise<void>((resolve) => server.listen(development.controlFile, resolve))

  let closed = false
  const window = {
    id: 17,
    close: () => {
      closed = true
    },
  } as unknown as BrowserWindow

  await writeDevelopmentReady(development, window)

  assert.equal(closed, true)
})

test('reports the readiness failure without surfacing an unavailable stderr write', () => {
  const error = new Error('Development launcher rejected Electron readiness.')
  const messages: string[] = []

  reportDevelopmentReadinessFailure(error, (message) => messages.push(message))

  assert.match(messages.join(''), /Development launcher rejected Electron readiness/)
  assert.doesNotThrow(() =>
    reportDevelopmentReadinessFailure(error, () => {
      throw new Error('write EIO')
    }),
  )
})
