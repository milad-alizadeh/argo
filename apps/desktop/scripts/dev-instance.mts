#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { mkdir, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { startControlServer } from './dev-control-server.mts'
import { stopElectronProcess, stopForgeProcess } from './dev-launch-stop.mts'
import {
  assertPortAvailable,
  freeLoopbackPort,
  integerPort,
  PORT_ENV,
  portFromHash,
} from './dev-ports.mts'
import { currentBranch, developmentBuildLabel } from './development-label.mts'

export { startControlServer } from './dev-control-server.mts'
export { assertPortAvailable, freeLoopbackPort, portCollisionError } from './dev-ports.mts'
export { developmentBuildLabel } from './development-label.mts'

const DESKTOP_ROOT = path.resolve(import.meta.dirname, '..')
const REPOSITORY_ROOT = path.resolve(DESKTOP_ROOT, '..', '..')
const INSTANCE_ROOT =
  process.platform === 'win32'
    ? path.join(os.tmpdir(), 'argo-desktop-dev')
    : path.join(path.parse(os.tmpdir()).root, 'tmp', 'argo-desktop-dev')

/** Everything one worktree's development launch is addressed by. */
export type DevelopmentInstance = {
  directory: string
  controlFile: string
  controlTokenFile: string
  id: string
  label: string
  port: number
  readyFile: string
  title: string
  userData: string
  worktree: string
}

export function developmentInstance(
  worktree: string,
  requestedPort: string | undefined = process.env[PORT_ENV],
  branch: string | null = null,
): DevelopmentInstance {
  const hash = createHash('sha256').update(worktree).digest('hex')
  const id = `${path.basename(worktree)}-${hash.slice(0, 8)}`
  const label = developmentBuildLabel(worktree, branch)
  const port = requestedPort ? integerPort(requestedPort) : portFromHash(hash)
  const directory = path.join(INSTANCE_ROOT, hash.slice(0, 16))

  return {
    directory,
    controlFile: path.join(directory, 'control.sock'),
    controlTokenFile: path.join(directory, 'control-token'),
    id,
    label,
    port,
    readyFile: path.join(directory, 'ready.json'),
    title: `Argo dev · ${label} · :${port}`,
    userData: path.join(directory, 'user-data'),
    worktree,
  }
}

function runLinker() {
  const linker = spawnSync(process.execPath, ['scripts/link-hoisted-electron.mts'], {
    cwd: DESKTOP_ROOT,
    stdio: 'inherit',
  })
  if (linker.status !== 0) process.exit(linker.status ?? 1)
}

async function main() {
  const worktree = await realpath(REPOSITORY_ROOT)
  const branch = currentBranch(worktree)
  const instance = developmentInstance(worktree, process.env[PORT_ENV], branch)
  await assertPortAvailable(instance.port, instance.id)
  await rm(instance.readyFile, { force: true })
  await rm(instance.controlFile, { force: true })
  await mkdir(instance.directory, { recursive: true })
  runLinker()
  const controlToken = randomBytes(32).toString('hex')
  const debugPort = await freeLoopbackPort()
  await writeFile(instance.controlTokenFile, `${controlToken}\n`, { mode: 0o600 })

  const child = spawn('electron-forge', ['start'], {
    cwd: DESKTOP_ROOT,
    // Forge starts Vite and Electron descendants. A dedicated process group
    // lets this launcher stop that complete tree after it has first targeted
    // the registered Electron PID, rather than leaving an orphan window.
    detached: process.platform !== 'win32',
    env: {
      ...process.env,
      ARGO_DESKTOP_DEBUG_PORT: String(debugPort),
      ARGO_DESKTOP_DEV_PORT: String(instance.port),
      ARGO_DESKTOP_INSTANCE_DIRECTORY: instance.directory,
      ARGO_DESKTOP_INSTANCE_ID: instance.id,
      ARGO_DESKTOP_BUILD_LABEL: instance.label,
      ARGO_DESKTOP_LAUNCHER_PID: String(process.pid),
      ARGO_DESKTOP_CONTROL_FILE: instance.controlFile,
      ARGO_DESKTOP_CONTROL_TOKEN: controlToken,
      ARGO_DESKTOP_WINDOW_TITLE: instance.title,
      ARGO_DESKTOP_WORKTREE: instance.worktree,
    },
    stdio: 'inherit',
  })

  let stopping = false
  const stop = async (electronProcessId?: number) => {
    stopping = true
    await stopElectronProcess(electronProcessId)
    stopForgeProcess(child)
  }
  const controlServer = await startControlServer(instance.controlFile, controlToken, stop)
  process.once('SIGINT', () => void stop())
  process.once('SIGTERM', () => void stop())
  child.once('exit', (code, signal) => {
    controlServer.close()
    void rm(instance.controlFile, { force: true })
    void rm(instance.controlTokenFile, { force: true })
    process.exit(stopping ? 0 : (code ?? (signal ? 1 : 0)))
  })
}

if (process.argv[1] === import.meta.filename) {
  main().catch((error) => {
    console.error((error as Error).message)
    process.exit(1)
  })
}
