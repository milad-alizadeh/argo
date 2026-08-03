#!/usr/bin/env node

/**
 * Composition-root gate: fails when a file lands loose at a composition root.
 *
 *   node scripts/composition-root-check.mjs --map apps/desktop/scripts/module-boundaries.json
 *
 * `dependency-cruiser` can only see EDGES — who imports whom. A feature's own hook parked at the
 * app root imports its slice through the slice's declared public entry, so every edge is legal and
 * the boundary gate passes; the file is simply in the wrong place. Placement is not an edge, which
 * is why it needs its own arithmetic instead of a review note (`rules/file-structure.md`:
 * group by domain, never let a folder root accumulate peer files).
 *
 * The root keeps only what genuinely belongs to no module: the bootstrap, the container that wires
 * the slices together, and its View. Everything else belongs inside the module that owns it.
 *
 * Config lives in the map's `placement.compositionRoot` block, `allow` for files that are
 * permanently the root's (KIND) and `ratchet` for debt (RATCHET) — a list that may only shrink.
 * Exits 0 clean, 1 on a breach or on a stale entry, 2 on bad usage.
 */

import { glob } from 'node:fs/promises'
import { basename } from 'node:path'
import { fail, placementBlock, readModuleMap } from './module-map.mjs'

const GATE = 'composition-root-check'

const argv = process.argv.slice(2)
const mapFlag = argv.indexOf('--map')
if (mapFlag === -1 || argv[mapFlag + 1] === undefined) {
  fail(GATE, 'usage: composition-root-check --map <module-boundaries.json>')
}

const { map, workspace } = await readModuleMap(argv[mapFlag + 1]).catch((error) =>
  fail(GATE, `cannot read the module map: ${error.message}`),
)
const config = placementBlock(map, GATE, 'compositionRoot')
const atRoot = new RegExp(config.path)
const allow = config.allow ?? {}
const ratchet = config.ratchet ?? {}

const unexpected = []
const seen = new Set()
for await (const relPath of glob('src/**/*.{ts,tsx}', { cwd: workspace })) {
  const posix = relPath.split('\\').join('/')
  if (!atRoot.test(posix)) continue
  const name = basename(posix)
  if (name in allow || name in ratchet) seen.add(name)
  else unexpected.push(posix)
}

// A stale exemption is its own failure: the ratchet may only shrink, so an entry that no longer
// names a real file has to leave the list rather than sit there re-authorising a future breach.
const stale = [...Object.keys(allow), ...Object.keys(ratchet)].filter((name) => !seen.has(name))

if (unexpected.length === 0 && stale.length === 0) process.exit(0)

if (unexpected.length > 0) {
  console.error(`${GATE}: ${unexpected.length} file(s) loose at the composition root\n`)
  for (const path of unexpected.sort()) console.error(`  ${path}`)
  console.error(
    '\nMove each into the module that owns it. If it truly belongs to no module, add it to' +
      '\n`placement.compositionRoot.allow` (KIND) or `.ratchet` (RATCHET) with its reason.',
  )
}

if (stale.length > 0) {
  console.error(`\n${GATE}: ${stale.length} stale exemption(s) naming no file — delete them:\n`)
  for (const name of stale.sort()) console.error(`  ${name}`)
}

process.exit(1)
