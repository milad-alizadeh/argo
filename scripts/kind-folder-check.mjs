#!/usr/bin/env node

/**
 * Kind-folder gate: fails when a folder groups files by what they ARE instead of what they're for.
 *
 *   node scripts/kind-folder-check.mjs --map apps/desktop/scripts/module-boundaries.json
 *
 * `rules/file-structure.md` bans these outright — "they become junk drawers: touching one feature
 * means hopping across five kind-buckets, and deleting a feature leaves orphans in each". The ban
 * had no teeth, and a kind-folder is the one structural mistake that looks tidy while it spreads,
 * so it gets counted. `components/` is not on the list: this repo's slices are `<slice>/components/`
 * by contract, and each one holds a single feature's components rather than the whole app's.
 *
 * Exits 0 clean, 1 on a breach or on a stale ratchet entry, 2 on bad usage.
 */

import { glob } from 'node:fs/promises'
import { basename } from 'node:path'
import { fail, placementBlock, readModuleMap } from './module-map.mjs'

const GATE = 'kind-folder-check'

const argv = process.argv.slice(2)
const mapFlag = argv.indexOf('--map')
if (mapFlag === -1 || argv[mapFlag + 1] === undefined) {
  fail(GATE, 'usage: kind-folder-check --map <module-boundaries.json>')
}

const { map, workspace } = await readModuleMap(argv[mapFlag + 1]).catch((error) =>
  fail(GATE, `cannot read the module map: ${error.message}`),
)
const config = placementBlock(map, GATE, 'kindFolders')
const banned = new Set(config.banned ?? [])
const ratchet = config.ratchet ?? {}

const found = new Map()
for await (const relPath of glob('src/**/*.{ts,tsx}', { cwd: workspace })) {
  const posix = relPath.split('\\').join('/')
  for (const segment of posix.split('/').slice(0, -1)) {
    if (banned.has(segment))
      found.set(posix.slice(0, posix.indexOf(segment) + segment.length), true)
  }
}

const breaches = [...found.keys()].filter((path) => !(path in ratchet))
const stale = Object.keys(ratchet).filter((path) => !found.has(path))

if (breaches.length === 0 && stale.length === 0) process.exit(0)

if (breaches.length > 0) {
  console.error(`${GATE}: ${breaches.length} kind-folder(s)\n`)
  for (const path of breaches.sort()) console.error(`  ${path}/  (grouped by "${basename(path)}")`)
  console.error(
    "\nMove each file next to the feature that uses it. A feature's types, schema and hooks" +
      "\nlive INSIDE that feature's folder — `checkout/schema`, never `schemas/checkout`.",
  )
}

if (stale.length > 0) {
  console.error(`\n${GATE}: ${stale.length} stale ratchet entry(ies) naming no folder — delete:\n`)
  for (const path of stale.sort()) console.error(`  ${path}`)
}

process.exit(1)
