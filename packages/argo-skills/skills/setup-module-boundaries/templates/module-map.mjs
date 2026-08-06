/**
 * Shared reader for a workspace's LLM-maintained module map
 * (`<workspace>/scripts/module-boundaries.json`).
 *
 * The map is the single source of truth for structure: `dependency-cruiser.cjs` compiles its
 * `modules` + `layers` into import rules, and the placement gates beside this file compile its
 * `placement` block into where-files-may-live rules. Import boundaries and file placement are
 * different questions — a file can sit in the wrong folder while every one of its imports is
 * legal — so they need separate gates over one map.
 */

import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

/** Read the map and locate the workspace it describes (paths in it are workspace-relative). */
export async function readModuleMap(mapPath) {
  const map = JSON.parse(await readFile(mapPath, 'utf8'))
  return { map, workspace: dirname(dirname(resolve(mapPath))) }
}

/**
 * Which module owns a workspace-relative path.
 *
 * Modules nest (`renderer` contains `shell`), so the most specific match wins — measured by the
 * length of the declared path regex, which is what "more specific" means for these prefixes.
 */
export function moduleOf(relPath, modules) {
  let owner = null
  for (const module of modules) {
    if (!new RegExp(module.path).test(relPath)) continue
    if (owner === null || module.path.length > owner.path.length) owner = module
  }
  return owner
}

/** A gate is a failure of the build, so a misconfigured one must never read as a pass. */
export function fail(gate, problem) {
  console.error(`${gate}: ${problem}`)
  process.exit(2)
}

/** Config lookup that refuses to silently no-op when the block is missing. */
export function placementBlock(map, gate, key) {
  const block = map.placement?.[key]
  if (block === undefined) fail(gate, `no "placement.${key}" block in the module map`)
  return block
}

/** A module's `placement.rootFiles` entry, or undefined when it has none declared. */
export function rootFilesEntry(map, moduleName) {
  return map.placement?.rootFiles?.modules?.[moduleName]
}

/**
 * Which paths count as AT a module's root: the entry's `path` when it overrides, else derived
 * from the module's own path. Shared by the CI gate and the write-time hook deliberately — two
 * copies of this derivation would let a file the hook permits fail the build minutes later.
 */
export function rootPattern(module, entry) {
  return new RegExp(entry?.path ?? `${module.path}[^/]+$`)
}
