#!/usr/bin/env node
// Gives `apps/desktop` an npm-shaped `node_modules` before Forge packages it, per
// [Reconsider the PTY host](https://github.com/milad-alizadeh/argo/issues/1791).
//
// Why this exists at all. Forge walks the app's dependencies with `flora-colossus` to decide what
// to keep in the package, and that walker only understands an npm-shaped tree: a directory per
// package under the app's own `node_modules`. Bun's workspace install hoists everything to the
// repository root and leaves `apps/desktop/node_modules` absent, so the walker finds nothing —
// and finding nothing is not an error to it. Forge exits 0 and ships an app with no `node-pty`
// (flora-colossus#44, forge#4188). The cost accepted for this is a second lockfile.
//
// The exec bit is restored here rather than trusted, because it is dropped by an install and
// nothing downstream complains: `node-pty` ships a prebuilt `spawn-helper` that must be
// executable, and a 0644 copy makes every `pty.spawn` fail SILENTLY — no error, no shell, an
// empty terminal. The repo hit this before and fixed it at `4dce8404^:scripts/fix-pty-perms.mjs`.
// Restoring it is not the assertion; `assert-packaged-pty.mjs` reads the mode off the PACKAGED
// binary, because a script that ran is not a bit that is set.
import { spawnSync } from 'node:child_process'
import { chmodSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

export const desktopRoot = path.resolve(import.meta.dirname, '..')
export const SPAWN_HELPER = 'spawn-helper'
export const EXECUTABLE_MODE = 0o755

// `npm ci` is the deterministic half: it deletes `node_modules` first and installs exactly what
// `package-lock.json` names, so a packaged tree never depends on what a previous run left behind.
// `--omit=dev` is what keeps the 400 KB of `node-pty` from arriving with 200 MB of Electron and
// Vite beside it; the dev half is still resolved from the root Bun install.
// `--workspaces=false` is not optional: npm walks UP for a package.json that lists this
// directory as a workspace, finds the repository root, and quietly installs there instead —
// leaving `apps/desktop/node_modules` absent, which is the exact failure this script exists to
// prevent.
const NPM_ARGS = ['ci', '--omit=dev', '--workspaces=false', '--no-audit', '--no-fund']

export function findSpawnHelpers(dir, hits = []) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return hits
  }
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name)
    if (entry.isDirectory()) findSpawnHelpers(entryPath, hits)
    else if (entry.name === SPAWN_HELPER) hits.push(entryPath)
  }
  return hits
}

export function restoreSpawnHelperMode(root) {
  const helpers = findSpawnHelpers(root)
  for (const helper of helpers) {
    chmodSync(helper, EXECUTABLE_MODE)
    if ((statSync(helper).mode & 0o111) === 0)
      throw new Error(`chmod on ${helper} left it non-executable`)
  }
  return helpers
}

export function productionInstall() {
  const installed = spawnSync('npm', NPM_ARGS, { cwd: desktopRoot, stdio: 'inherit' })
  if (installed.error) throw installed.error
  if (installed.status !== 0)
    throw new Error(`npm ${NPM_ARGS.join(' ')} exited ${installed.status} in ${desktopRoot}`)

  const helpers = restoreSpawnHelperMode(path.join(desktopRoot, 'node_modules'))
  if (helpers.length === 0)
    throw new Error(
      `the production install produced no ${SPAWN_HELPER}, so node-pty is not in the tree Forge ` +
        `is about to walk. Check apps/desktop/package-lock.json.`,
    )
  return helpers
}

// Runs standalone as well as from the Forge hook, so the failure can be reproduced without a
// fifteen-minute package.
if (process.argv[1] === import.meta.filename) {
  const helpers = productionInstall()
  process.stdout.write(`production install ready; ${helpers.length} ${SPAWN_HELPER} made +x\n`)
}
