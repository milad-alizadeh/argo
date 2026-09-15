#!/usr/bin/env node
/**
 * A real desktop proof, deliberately separate from the fast unit tests.
 *
 * Run from one worktree and give it another worktree with dependencies installed:
 *
 *   bun run dev:prove-isolation -- /absolute/path/to/other/argo/worktree
 */
import { spawn } from 'node:child_process'
import { access, realpath } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { parseReadyRecord, processIsRunning } from './dev-control.mjs'
import { developmentInstance } from './dev-instance.mjs'

const DESKTOP_ROOT = path.resolve(import.meta.dirname, '..')
const REPOSITORY_ROOT = path.resolve(DESKTOP_ROOT, '..', '..')
const OTHER_WORKTREE = process.argv[2]
const TIMEOUT = 45_000

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function waitFor(check, description) {
  const deadline = Date.now() + TIMEOUT
  let lastError
  while (Date.now() < deadline) {
    try {
      const value = await check()
      if (value) return value
    } catch (error) {
      lastError = error
    }
    await delay(200)
  }
  throw new Error(
    `Timed out waiting for ${description}.${lastError ? ` ${lastError.message}` : ''}`,
  )
}

function run(worktree, args, stdio = 'pipe') {
  return spawn('bun', args, { cwd: worktree, stdio })
}

async function status(worktree) {
  const child = run(worktree, ['run', 'desktop:status'])
  const chunks = []
  const errors = []
  child.stdout.on('data', (chunk) => chunks.push(chunk))
  child.stderr.on('data', (chunk) => errors.push(chunk))
  const code = await new Promise((resolve) => child.once('exit', resolve))
  if (code !== 0) throw new Error(Buffer.concat(errors).toString().trim())
  return parseReadyRecord(JSON.parse(Buffer.concat(chunks).toString()))
}

async function readyStatus(worktree) {
  return waitFor(async () => {
    const record = await status(worktree)
    if (!processIsRunning(record.processId)) throw new Error('recorded Electron process is gone')
    return record
  }, `the Electron window for ${worktree}`)
}

async function stop(worktree) {
  const child = run(worktree, ['run', 'desktop:stop'])
  const code = await new Promise((resolve) => child.once('exit', resolve))
  if (code !== 0) throw new Error(`desktop:stop failed for ${worktree}`)
}

async function absent(instance, processId) {
  await waitFor(async () => {
    if (processIsRunning(processId)) return false
    try {
      await access(instance.readyFile)
      return false
    } catch {
      return true
    }
  }, `Electron ${processId} and its ready record to disappear`)
}

async function main() {
  if (!OTHER_WORKTREE || !path.isAbsolute(OTHER_WORKTREE))
    throw new Error('Pass an absolute path to a second worktree with dependencies installed.')

  const first = await realpath(REPOSITORY_ROOT)
  const second = await realpath(OTHER_WORKTREE)
  if (first === second) throw new Error('The second worktree must differ from this one.')

  const firstInstance = developmentInstance(first)
  const firstLaunch = run(first, ['run', 'dev'], 'inherit')
  const secondLaunch = run(second, ['run', 'dev'], 'inherit')

  try {
    const [firstReady, secondReady] = await Promise.all([readyStatus(first), readyStatus(second)])
    for (const field of ['port', 'title', 'userData', 'worktree']) {
      if (firstReady[field] === secondReady[field])
        throw new Error(`The two ready records share ${field}; worktree isolation is broken.`)
    }
    if (!firstReady.windowId || !secondReady.windowId)
      throw new Error('Electron did not report an actual BrowserWindow for both instances.')

    await stop(first)
    await absent(firstInstance, firstReady.processId)

    const surviving = await readyStatus(second)
    if (surviving.processId !== secondReady.processId)
      throw new Error('Stopping the first worktree restarted or replaced the second Electron app.')

    process.stdout.write(
      `Proved isolated Electron development launches: ${firstReady.title} stopped; ${secondReady.title} remained ready.\n`,
    )
  } finally {
    // Each stop reads only its own ready record. The proof cannot target an
    // unrelated worktree, even during cleanup.
    for (const worktree of [first, second]) {
      try {
        await stop(worktree)
      } catch {}
    }
    firstLaunch.kill('SIGTERM')
    secondLaunch.kill('SIGTERM')
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
