#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { mkdir, realpath, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { startControlServer } from './dev-control-server.mjs'
import { stopElectronProcess, stopForgeProcess } from './dev-launch-stop.mjs'

const DESKTOP_ROOT = path.resolve(import.meta.dirname, '..')
const REPOSITORY_ROOT = path.resolve(DESKTOP_ROOT, '..', '..')
const PORT_ENV = 'ARGO_DESKTOP_DEV_PORT'
const PORT_START = 41_000
const PORT_COUNT = 20_000
const INSTANCE_ROOT =
  process.platform === 'win32'
    ? path.join(os.tmpdir(), 'argo-desktop-dev')
    : path.join(path.parse(os.tmpdir()).root, 'tmp', 'argo-desktop-dev')

function integerPort(value) {
  const port = Number(value)
  if (!Number.isSafeInteger(port) || port < 1024 || port > 65_535)
    throw new Error(`${PORT_ENV} must be an integer between 1024 and 65535.`)
  return port
}

export function developmentInstance(worktree, requestedPort = process.env[PORT_ENV]) {
  const hash = createHash('sha256').update(worktree).digest('hex')
  const id = `${path.basename(worktree)}-${hash.slice(0, 8)}`
  const port = requestedPort
    ? integerPort(requestedPort)
    : PORT_START + (Number.parseInt(hash.slice(0, 8), 16) % PORT_COUNT)
  const directory = path.join(INSTANCE_ROOT, hash.slice(0, 16))

  return {
    directory,
    controlFile: path.join(directory, 'control.sock'),
    controlTokenFile: path.join(directory, 'control-token'),
    id,
    port,
    readyFile: path.join(directory, 'ready.json'),
    title: `Argo dev · ${id} · :${port}`,
    userData: path.join(directory, 'user-data'),
    worktree,
  }
}

export function portCollisionError(port, identity) {
  return new Error(
    `Port ${port} for ${identity} is already in use. Stop that development run or set ${PORT_ENV} to a free port.`,
  )
}

async function assertPortAvailableOnHost(port, host, identity) {
  await new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        reject(portCollisionError(port, identity))
        return
      }
      // IPv6 can be disabled on a perfectly usable local development host.
      // Vite will bind its IPv4 loopback address in that case, so this is not a
      // collision and must not prevent an isolated desktop launch.
      if (host === '::1' && ['EADDRNOTAVAIL', 'EAFNOSUPPORT'].includes(error.code)) {
        resolve()
        return
      }
      reject(error)
    })
    server.listen(port, host, () => server.close(resolve))
  })
}

export async function assertPortAvailable(port, identity) {
  await assertPortAvailableOnHost(port, '127.0.0.1', identity)
  await assertPortAvailableOnHost(port, '::1', identity)
}

export { startControlServer } from './dev-control-server.mjs'

function runLinker() {
  const linker = spawnSync(process.execPath, ['scripts/link-hoisted-electron.mjs'], {
    cwd: DESKTOP_ROOT,
    stdio: 'inherit',
  })
  if (linker.status !== 0) process.exit(linker.status ?? 1)
}

async function main() {
  const worktree = await realpath(REPOSITORY_ROOT)
  const instance = developmentInstance(worktree)
  await assertPortAvailable(instance.port, instance.id)
  await rm(instance.readyFile, { force: true })
  await rm(instance.controlFile, { force: true })
  await mkdir(instance.directory, { recursive: true })
  runLinker()
  const controlToken = randomBytes(32).toString('hex')
  await writeFile(instance.controlTokenFile, `${controlToken}\n`, { mode: 0o600 })

  const child = spawn('electron-forge', ['start'], {
    cwd: DESKTOP_ROOT,
    // Forge starts Vite and Electron descendants. A dedicated process group
    // lets this launcher stop that complete tree after it has first targeted
    // the registered Electron PID, rather than leaving an orphan window.
    detached: process.platform !== 'win32',
    env: {
      ...process.env,
      ARGO_DESKTOP_DEV_PORT: String(instance.port),
      ARGO_DESKTOP_INSTANCE_DIRECTORY: instance.directory,
      ARGO_DESKTOP_INSTANCE_ID: instance.id,
      ARGO_DESKTOP_LAUNCHER_PID: String(process.pid),
      ARGO_DESKTOP_CONTROL_FILE: instance.controlFile,
      ARGO_DESKTOP_CONTROL_TOKEN: controlToken,
      ARGO_DESKTOP_WINDOW_TITLE: instance.title,
      ARGO_DESKTOP_WORKTREE: instance.worktree,
    },
    stdio: 'inherit',
  })

  let stopping = false
  const stop = async (electronProcessId) => {
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
    console.error(error.message)
    process.exit(1)
  })
}
