import { setSystemTime } from 'bun:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { TestContext } from 'node:test'
import { test } from 'node:test'

import { findExecutableOnLoginShellPath } from './executable-path'

async function directory(context: TestContext) {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'argo-login-shell-bin-'))
  context.after(() => rm(folder, { recursive: true, force: true }))
  return folder
}

// A mock login shell: it ignores the `-ilc` flags a real one is called with and runs `body`.
async function loginShell(context: TestContext, body: string) {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'argo-login-shell-'))
  context.after(() => rm(folder, { recursive: true, force: true }))
  const shell = path.join(folder, 'shell.sh')
  writeFileSync(shell, `#!/bin/sh\n${body}`, { mode: 0o700 })
  return shell
}

// States the PATH the test wants read back, the way a person's `.zshrc` would after a version
// manager runs. With `runs`, it also writes one line there each time it starts.
function loginShellNaming(context: TestContext, directoryToNamed: string, runs?: string) {
  const count = runs ? `echo run >> "${runs}"\n` : ''
  return loginShell(context, `${count}printf '%s\\n' "${directoryToNamed}"\n`)
}

function runCount(runs: string) {
  return readFileSync(runs, 'utf8').split('\n').filter(Boolean).length
}

function withEnvironment<T>(overrides: Record<string, string | undefined>, run: () => T): T {
  const previous = { SHELL: process.env.SHELL, PATH: process.env.PATH }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  try {
    return run()
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

test('finds a Harness on a directory the login shell PATH names', async (context) => {
  const bin = await directory(context)
  writeFileSync(path.join(bin, 'widget'), '#!/bin/sh\n', { mode: 0o700 })
  const shell = await loginShellNaming(context, bin)

  const found = withEnvironment({ SHELL: shell }, () => findExecutableOnLoginShellPath('widget'))

  assert.equal(found, path.join(bin, 'widget'))
})

test('reports no executable when the login shell PATH names no matching file', async (context) => {
  const bin = await directory(context)
  const shell = await loginShellNaming(context, bin)

  const found = withEnvironment({ SHELL: shell }, () => findExecutableOnLoginShellPath('widget'))

  assert.equal(found, null)
})

test('skips a file on the PATH that is not executable', async (context) => {
  const bin = await directory(context)
  writeFileSync(path.join(bin, 'widget'), '#!/bin/sh\n', { mode: 0o600 })
  const shell = await loginShellNaming(context, bin)

  const found = withEnvironment({ SHELL: shell }, () => findExecutableOnLoginShellPath('widget'))

  assert.equal(found, null)
})

test('falls back to process.env.PATH when SHELL is unset', async (context) => {
  const bin = await directory(context)
  writeFileSync(path.join(bin, 'widget'), '#!/bin/sh\n', { mode: 0o700 })

  const found = withEnvironment({ SHELL: undefined, PATH: bin }, () =>
    findExecutableOnLoginShellPath('widget'),
  )

  assert.equal(found, path.join(bin, 'widget'))
})

test('falls back to process.env.PATH when the login shell fails', async (context) => {
  const bin = await directory(context)
  writeFileSync(path.join(bin, 'widget'), '#!/bin/sh\n', { mode: 0o700 })
  const brokenShell = path.join(bin, 'does-not-exist-shell')

  const found = withEnvironment({ SHELL: brokenShell, PATH: bin }, () =>
    findExecutableOnLoginShellPath('widget'),
  )

  assert.equal(found, path.join(bin, 'widget'))
})

test('runs the login shell once for many lookups and finds a Harness added to the same folder', async (context) => {
  const bin = await directory(context)
  writeFileSync(path.join(bin, 'widget'), '#!/bin/sh\n', { mode: 0o700 })
  const runs = path.join(await directory(context), 'runs')
  const shell = await loginShellNaming(context, bin, runs)

  const found = withEnvironment({ SHELL: shell }, () => {
    const first = [
      findExecutableOnLoginShellPath('widget'),
      findExecutableOnLoginShellPath('gadget'),
      findExecutableOnLoginShellPath('widget'),
      findExecutableOnLoginShellPath('gadget'),
    ]
    writeFileSync(path.join(bin, 'gadget'), '#!/bin/sh\n', { mode: 0o700 })
    return [...first, findExecutableOnLoginShellPath('gadget')]
  })

  assert.deepEqual(found, [
    path.join(bin, 'widget'),
    null,
    path.join(bin, 'widget'),
    null,
    path.join(bin, 'gadget'),
  ])
  assert.equal(runCount(runs), 1)
})

test('retries a failed login shell read on the next lookup', async (context) => {
  const bin = await directory(context)
  writeFileSync(path.join(bin, 'widget'), '#!/bin/sh\n', { mode: 0o700 })
  const failedOnce = path.join(await directory(context), 'failed-once')
  const shell = await loginShell(
    context,
    `[ -e "${failedOnce}" ] || { touch "${failedOnce}"; exit 1; }\nprintf '%s\\n' "${bin}"\n`,
  )
  const empty = await directory(context)

  const found = withEnvironment({ SHELL: shell, PATH: empty }, () => [
    findExecutableOnLoginShellPath('widget'),
    findExecutableOnLoginShellPath('widget'),
  ])

  assert.deepEqual(found, [null, path.join(bin, 'widget')])
})

test('a miss re-reads the login PATH only after the interval, so a new PATH folder is found', async (context) => {
  const before = await directory(context)
  const after = await directory(context)
  const pathFile = path.join(await directory(context), 'path')
  const runs = path.join(await directory(context), 'runs')
  writeFileSync(pathFile, before)
  const shell = await loginShell(context, `echo run >> "${runs}"\ncat "${pathFile}"\n`)
  context.after(() => setSystemTime())

  const found = withEnvironment({ SHELL: shell }, () => {
    setSystemTime(new Date(1_000_000))
    const atLaunch = [
      findExecutableOnLoginShellPath('widget'),
      findExecutableOnLoginShellPath('widget'),
    ]
    // An installer adds a new folder to the login PATH and puts the Harness there.
    writeFileSync(path.join(after, 'widget'), '#!/bin/sh\n', { mode: 0o700 })
    writeFileSync(pathFile, after)
    const soon = findExecutableOnLoginShellPath('widget')
    setSystemTime(new Date(1_031_000))
    return [...atLaunch, soon, findExecutableOnLoginShellPath('widget')]
  })

  assert.deepEqual(found, [null, null, null, path.join(after, 'widget')])
  assert.equal(runCount(runs), 2)
})
