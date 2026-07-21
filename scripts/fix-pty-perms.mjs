#!/usr/bin/env node
/**
 * node-pty ships a prebuilt `spawn-helper` binary that MUST be executable, but bun's install
 * extraction drops the exec bit (files land as 0644) → every `pty.spawn` fails silently and the
 * Console's live terminal never gets a shell. Restore +x on every `spawn-helper` under
 * node_modules. Wired as the root `postinstall` so it survives reinstalls.
 */
import { chmodSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

function findSpawnHelpers(dir, hits = []) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return hits
  }
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) findSpawnHelpers(path, hits)
    else if (entry.name === 'spawn-helper') hits.push(path)
  }
  return hits
}

// Scan node_modules (bun may hoist node-pty directly or under .bun, depending on layout).
const root = process.argv[2] ?? 'node_modules'
let fixed = 0
for (const helper of findSpawnHelpers(root)) {
  try {
    chmodSync(helper, 0o755)
    fixed++
  } catch {
    /* best-effort */
  }
}
console.log(`fix-pty-perms: chmod +x on ${fixed} spawn-helper binary(ies)`)
