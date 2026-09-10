#!/usr/bin/env node
// Gives Forge a path to Electron before `electron-forge start`, #1791.
//
// Forge resolves the Electron executable with its own walk, not Node's. `determineNodeModulesPath`
// looks in `<app>/node_modules/electron`, and when that is absent it calls find-up for a
// `package-lock.json`, `yarn.lock` or `pnpm-lock.yaml` and looks beside THAT. It does not know
// `bun.lock`. This app carries its own `package-lock.json` for the packaging walker, so the
// find-up stops here, one directory short of the root Bun install that holds Electron, and Forge
// throws `Cannot find the package "electron"` before any fallback runs.
//
// A link is enough because Forge only tests that the path exists and then requires it. `npm ci`
// in `production-install.mjs` empties this directory at package time, which is why the link is
// made on every dev run rather than once.
import { existsSync, lstatSync, mkdirSync, symlinkSync, unlinkSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const desktopRoot = path.resolve(import.meta.dirname, '..')
const repositoryRoot = path.resolve(desktopRoot, '..', '..')
const hoisted = path.join(repositoryRoot, 'node_modules', 'electron')
const link = path.join(desktopRoot, 'node_modules', 'electron')

if (!existsSync(path.join(hoisted, 'dist'))) {
  console.error(
    `no installed Electron at ${hoisted}. Run \`bun install\` and \`bun run install:electron\` ` +
      'from the repository root.',
  )
  process.exit(1)
}

// lstat, never exists: a link left pointing at a deleted install reads as absent and then fails
// the symlink call with EEXIST.
let existing
try {
  existing = lstatSync(link)
} catch {
  existing = undefined
}

if (existing?.isSymbolicLink() && !existsSync(link)) unlinkSync(link)
else if (existing) process.exit(0)

mkdirSync(path.dirname(link), { recursive: true })
symlinkSync(path.relative(path.dirname(link), hoisted), link, 'dir')
