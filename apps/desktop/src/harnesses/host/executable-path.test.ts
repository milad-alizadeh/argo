import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { TestContext } from 'node:test'
import { test } from 'node:test'

import { findExecutableOnLoginShellPath } from '@/harnesses/host/executable-path'

async function directory(context: TestContext) {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'argo-login-shell-bin-'))
  context.after(() => rm(folder, { recursive: true, force: true }))
  return folder
}

// A mock login shell: it ignores the `-ilc` flags a real one is called with and just states the
// PATH the test wants read back, the way a person's `.zshrc` would after a version manager runs.
async function loginShellNaming(context: TestContext, directoryToNamed: string) {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'argo-login-shell-'))
  context.after(() => rm(folder, { recursive: true, force: true }))
  const shell = path.join(folder, 'shell.sh')
  writeFileSync(shell, `#!/bin/sh\nprintf '%s\\n' "${directoryToNamed}"\n`, { mode: 0o700 })
  return shell
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
