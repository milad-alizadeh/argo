// Locating, running and judging a PACKAGED Argo app. The driver that uses this is
// prove-packaged-pty.mjs; the acceptance test it serves is #1743.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

export const RESULT_PREFIX = 'ARGO_PTY_SMOKE_RESULT '
export const LAUNCH_TIMEOUT_MS = 60_000
export const PACKAGE_TIMEOUT_MS = 15 * 60_000

const APP_NAME = 'Argo'
const EXECUTABLE = 'Argo'
const EXPECTED_UNAME = { arm64: 'arm64', x64: 'x86_64' }

export const desktopRoot = path.resolve(import.meta.dirname, '..')

export function run(command, args, { timeoutMs, env }) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: desktopRoot,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, timeoutMs)

    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('close', (code, signal) => {
      clearTimeout(timer)
      resolve({ code, signal, stdout, stderr, timedOut })
    })
  })
}

// Never `npx electron-forge`: npx resolves the bare name against the registry and installs
// electron-forge@5.2.4 from 2018, which then dies asking for electron-prebuilt-compile. The CLI
// this app pins is @electron-forge/cli, and this is its binary. Bun's linker decides whether this
// package or the workspace root holds node_modules, so look in both rather than assume a layout.
export function forgeBinary() {
  const candidates = [
    path.join(desktopRoot, 'node_modules', '.bin', 'electron-forge'),
    path.join(desktopRoot, '..', '..', 'node_modules', '.bin', 'electron-forge'),
  ]
  const found = candidates.find((candidate) => existsSync(candidate))
  if (!found)
    throw new Error(`no electron-forge binary found. Looked in:\n  ${candidates.join('\n  ')}`)
  return found
}

// Forge names the output directory out/<app>-darwin-<arch>.
export function appBinary(arch) {
  return path.join(
    desktopRoot,
    'out',
    `${APP_NAME}-darwin-${arch}`,
    `${APP_NAME}.app`,
    'Contents',
    'MacOS',
    EXECUTABLE,
  )
}

export function readResult(stdout) {
  const line = stdout.split('\n').find((candidate) => candidate.startsWith(RESULT_PREFIX))
  if (!line) return null
  try {
    return JSON.parse(line.slice(RESULT_PREFIX.length))
  } catch {
    return null
  }
}

// A clean exit is code 0, no killing signal, and not our own timeout.
export function exitFailures(launched) {
  const failures = []
  if (launched.timedOut) failures.push(`the app did not exit within ${LAUNCH_TIMEOUT_MS}ms`)
  if (launched.code !== 0) failures.push(`exit code was ${launched.code}, expected 0`)
  if (launched.signal) failures.push(`the app died on signal ${launched.signal}`)
  return failures
}

// The app has to prove it was the packaged one, built for the architecture asked for, and that a
// real shell ran inside the PTY it opened.
export function resultFailures(result, arch) {
  if (!result) return ['the app printed no smoke result; node-pty may have failed to load']
  const failures = []
  if (result.ok !== true) failures.push(`the PTY check failed: ${result.error}`)
  if (result.packaged !== true)
    failures.push('app.isPackaged was false, so this was not the packaged app')
  if (result.processArch !== arch)
    failures.push(`process.arch was ${result.processArch}, expected ${arch}`)
  if (result.ptyUname !== EXPECTED_UNAME[arch])
    failures.push(
      `the shell inside the PTY reported ${result.ptyUname}, expected ${EXPECTED_UNAME[arch]}`,
    )
  return failures
}
