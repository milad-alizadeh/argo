#!/usr/bin/env node

/**
 * Root-files gate: fails when a file lands loose at ANY module's root.
 *
 *   node scripts/root-files-check.mjs --map apps/desktop/scripts/module-boundaries.json
 *
 * `dependency-cruiser` can only see EDGES — who imports whom. A feature's own hook parked at its
 * module root imports that module through its declared public entry, so every edge is legal and the
 * boundary gate passes; the file is simply in the wrong place. Placement is not an edge, which is
 * why it needs its own arithmetic instead of a review note (`rules/file-structure.md`: group by
 * domain, never let a folder root accumulate peer files).
 *
 * A module root keeps only what genuinely belongs to no sub-domain: the public entry, a bootstrap,
 * the container that wires the parts together. Everything else belongs inside the folder that owns
 * it — and "there was nowhere to put it" is the report that a sub-domain is missing, not a licence
 * to use the root as one.
 *
 * THE DEFAULT IS GUARDED (ADR-0021). This gate replaced a predecessor that guarded one hardcoded
 * path, which meant a module absent from the config was silently exempt — and every module added
 * after it inherited that exemption and flattened. So a module declared in `modules` with no
 * `placement.rootFiles.modules` entry is a FAILURE, not a pass. Adding a module costs one key.
 *
 * Per module: `path` overrides the root pattern derived from the module's own `path` (the renderer
 * needs it — its module path is `src/renderer/`, its root is `src/renderer/src/`); `allow` is for
 * files permanently the root's (KIND) and `ratchet` for debt (RATCHET), a list that may only
 * shrink. Exits 0 clean, 1 on a breach or a stale entry, 2 on bad usage.
 */

import { glob } from 'node:fs/promises'
import { basename } from 'node:path'
import { fail, moduleOf, placementBlock, readModuleMap } from './module-map.mjs'

const GATE = 'root-files-check'

const argv = process.argv.slice(2)
const mapFlag = argv.indexOf('--map')
if (mapFlag === -1 || argv[mapFlag + 1] === undefined) {
  fail(GATE, 'usage: root-files-check --map <module-boundaries.json>')
}

const { map, workspace } = await readModuleMap(argv[mapFlag + 1]).catch((error) =>
  fail(GATE, `cannot read the module map: ${error.message}`),
)
const declared = placementBlock(map, GATE, 'rootFiles').modules ?? {}

/** Every module guarded, every guard naming a module — the inversion this gate exists for. */
function roots(modules) {
  const missing = modules.filter((module) => !(module.name in declared)).map((m) => m.name)
  if (missing.length > 0) {
    fail(GATE, `module(s) with no "placement.rootFiles.modules" entry: ${missing.join(', ')}`)
  }
  const names = new Set(modules.map((module) => module.name))
  const unknown = Object.keys(declared).filter((name) => !names.has(name))
  if (unknown.length > 0) fail(GATE, `rootFiles entr(ies) naming no module: ${unknown.join(', ')}`)

  return new Map(
    modules.map((module) => {
      const entry = declared[module.name]
      const pattern = entry.path ?? `${module.path}[^/]+$`
      return [
        module.name,
        { at: new RegExp(pattern), allow: entry.allow ?? {}, ratchet: entry.ratchet ?? {} },
      ]
    }),
  )
}

const guards = roots(map.modules)
const loose = []
const orphans = []
const seen = new Map(map.modules.map((module) => [module.name, new Set()]))

for await (const relPath of glob('src/**/*.{ts,tsx}', { cwd: workspace })) {
  const posix = relPath.split('\\').join('/')
  const owner = moduleOf(posix, map.modules)
  if (owner === null) {
    orphans.push(posix)
    continue
  }
  const guard = guards.get(owner.name)
  if (!guard.at.test(posix)) continue
  const name = basename(posix)
  if (name in guard.allow || name in guard.ratchet) seen.get(owner.name).add(name)
  else loose.push({ module: owner.name, path: posix })
}

// A stale exemption is its own failure: the ratchet may only shrink, so an entry that no longer
// names a real file has to leave the list rather than sit there re-authorising a future breach.
const stale = []
for (const [name, guard] of guards) {
  const found = seen.get(name)
  for (const file of [...Object.keys(guard.allow), ...Object.keys(guard.ratchet)]) {
    if (!found.has(file)) stale.push(`${name}/${file}`)
  }
}

if (loose.length === 0 && stale.length === 0 && orphans.length === 0) process.exit(0)

if (loose.length > 0) {
  console.error(`${GATE}: ${loose.length} file(s) loose at a module root\n`)
  for (const { module, path } of loose.sort((a, b) => a.path.localeCompare(b.path))) {
    console.error(`  [${module}] ${path}`)
  }
  console.error(
    '\nA module root is not a folder for leftovers. Move each file into the sub-domain that owns' +
      '\nit — name the folder for what the code is FOR, never for what it IS (`utils/`, `types/`,' +
      "\n`hooks/` are banned outright). If a file belongs to no sub-domain, add it to that module's" +
      '\n`placement.rootFiles.modules.<module>.allow` (KIND) or `.ratchet` (RATCHET) with its reason.',
  )
}

if (orphans.length > 0) {
  console.error(`\n${GATE}: ${orphans.length} file(s) in no declared module — add the module:\n`)
  for (const path of orphans.sort()) console.error(`  ${path}`)
}

if (stale.length > 0) {
  console.error(`\n${GATE}: ${stale.length} stale exemption(s) naming no file — delete them:\n`)
  for (const entry of stale.sort()) console.error(`  ${entry}`)
}

process.exit(1)
