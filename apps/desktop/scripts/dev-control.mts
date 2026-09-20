#!/usr/bin/env node
import { access, readFile, realpath } from 'node:fs/promises'
import { createConnection } from 'node:net'
import path from 'node:path'
import process from 'node:process'
import { developmentInstance } from './dev-instance.mts'

const DESKTOP_ROOT = path.resolve(import.meta.dirname, '..')
const REPOSITORY_ROOT = path.resolve(DESKTOP_ROOT, '..', '..')

function positiveInteger(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1)
    throw new Error(`Ready record has invalid ${name}.`)
  return value
}

function text(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value) throw new Error(`Ready record has invalid ${name}.`)
  return value
}

/** What the launcher writes once its window is up, in the shape the readers rely on. */
export type ReadyRecord = {
  id: string
  label: string
  launcherPid: number
  port: number
  debugPort: number
  processId: number
  state: 'ready'
  title: string
  userData: string
  version: 1
  windowId: number
  worktree: string
}

export function parseReadyRecord(value: unknown): ReadyRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Ready record must be an object.')
  const record = value as Record<string, unknown>
  if (record.state !== 'ready') throw new Error('Ready record has invalid state.')
  if (record.version !== 1) throw new Error('Ready record has invalid version.')

  return {
    id: text(record.id, 'id'),
    label: text(record.label, 'label'),
    launcherPid: positiveInteger(record.launcherPid, 'launcherPid'),
    port: positiveInteger(record.port, 'port'),
    debugPort: positiveInteger(record.debugPort, 'debugPort'),
    processId: positiveInteger(record.processId, 'processId'),
    state: record.state,
    title: text(record.title, 'title'),
    userData: text(record.userData, 'userData'),
    version: record.version,
    windowId: positiveInteger(record.windowId, 'windowId'),
    worktree: text(record.worktree, 'worktree'),
  }
}

export function stopDevelopmentInstance(
  controlFile: string,
  processId: number,
  controlToken: string,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const socket = createConnection(controlFile)
    socket.once('error', () => reject(new Error('The development launcher is not running.')))
    socket.once('connect', () => socket.write(`stop ${processId} ${controlToken}`))
    socket.once('data', (reply) => {
      if (reply.toString() === 'stopped') resolve()
      else reject(new Error('The development launcher rejected the stop request.'))
      socket.end()
    })
  })
}

export function processIsRunning(
  processId: number,
  kill: (pid: number, signal: number) => unknown = process.kill,
): boolean {
  try {
    kill(processId, 0)
    return true
  } catch (error) {
    if (error && typeof error === 'object' && (error as NodeJS.ErrnoException).code === 'ESRCH')
      return false
    throw error
  }
}

async function readyRecord(worktree: string) {
  const instance = developmentInstance(worktree)
  try {
    await access(instance.readyFile)
  } catch {
    throw new Error(`No ready development instance exists for ${instance.id}.`)
  }

  const record = parseReadyRecord(JSON.parse(await readFile(instance.readyFile, 'utf8')))
  if (
    record.id !== instance.id ||
    record.worktree !== worktree ||
    record.userData !== instance.userData
  )
    throw new Error(`The ready record for ${instance.id} does not match this worktree.`)
  const controlToken = (await readFile(instance.controlTokenFile, 'utf8')).trim()
  if (!controlToken) throw new Error(`The control token for ${instance.id} is missing.`)
  return { instance, record, controlToken }
}

async function main() {
  const worktree = await realpath(REPOSITORY_ROOT)
  const { instance, record, controlToken } = await readyRecord(worktree)
  const command = process.argv[2]

  switch (command) {
    case 'status':
      process.stdout.write(`${JSON.stringify({ ...record, readyFile: instance.readyFile })}\n`)
      return
    case 'stop':
      // The launcher registered this exact Electron PID after its BrowserWindow
      // loaded. It owns the process; a stale ready file cannot make this command
      // signal an unrelated PID that the operating system has reused.
      try {
        await stopDevelopmentInstance(instance.controlFile, record.processId, controlToken)
      } catch (error) {
        // Electron exiting normally makes Forge close the socket itself. That
        // is a successful shutdown, not a reason to report a failed stop.
        if (
          !(error instanceof Error) ||
          error.message !== 'The development launcher is not running.'
        )
          throw error
      }
      process.stdout.write(`Stopped ${instance.id}.\n`)
      return
    default:
      throw new Error('Usage: node scripts/dev-control.mts <status|stop>')
  }
}

if (process.argv[1] === import.meta.filename) {
  main().catch((error) => {
    console.error((error as Error).message)
    process.exit(1)
  })
}
