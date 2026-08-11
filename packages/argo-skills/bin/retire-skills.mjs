// Uninstall the skills the manifest RETIRED — renamed away, split, or deleted.
//
// `skills add` only ever adds, so a name removed from the lock stays installed and keeps
// advertising itself. Two skills then compete for the same prompts and the retired one
// sometimes wins, which is the failure this exists to prevent: the rename looked done and the
// old behaviour was still reachable.
//
// It deletes only names the manifest lists in `retired`, never names merely absent from
// `skills`: inferring orphans from absence would take out anything installed out of band
// (graphify installs its own skill; a project may hand-write one). An explicit list is the
// only safe signal, and it doubles as the rename ledger.
//
// Within that list, `protect-owned-skills.mjs`'s tracked-in-git test is the second filter —
// a retired name is ordinary English, and the consumer's own skill of that name is kept.

import { lstatSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { SKILL_DIRS } from './protect-owned-skills.mjs'

/**
 * A name in both lists is a contradiction the install cannot resolve — whichever step ran last
 * would win silently, so the caller refuses instead of picking.
 * @param {{ skills: Record<string, unknown>, retired?: string[] }} manifest
 * @returns {string[]} names listed as both installed and retired
 */
export function contradictoryNames(manifest) {
  return (manifest.retired ?? []).filter((name) => manifest.skills[name])
}

/**
 * Remove every installed copy of every retired name, across all agent skill directories.
 * Idempotent: a second run finds nothing and reports nothing.
 *
 * Matching is by name alone, and a retired name is ordinary English — `qa` is one a team
 * picks independently. So anything git tracks under a skills directory is kept and reported:
 * vendored payloads land in gitignored directories, which makes tracked-in-git the same
 * ownership test `protect-owned-skills.mjs` uses, and a collision there is the consumer's own
 * skill wearing a name the bundle happens to have dropped.
 * @param {string} root repo root
 * @param {string[]} retired names from the manifest's `retired` array
 * @param {{ dryRun?: boolean, owned?: string[] }} options `dryRun` reports without removing;
 *   `owned` is the tracked-path list from `snapshotOwnedSkills`
 * @returns {{ removed: string[], kept: string[] }} repo-relative paths, removed and spared
 */
export function retireSkills(root, retired, { dryRun = false, owned = [] } = {}) {
  const removed = []
  const kept = []
  for (const name of retired) {
    for (const dir of SKILL_DIRS) {
      const rel = `${dir}/${name}`
      const path = resolve(root, rel)
      // lstat, not existsSync: `skills add` publishes symlinks, and a link whose payload is
      // already gone still shadows the name.
      try {
        lstatSync(path)
      } catch {
        continue
      }
      if (owned.some((file) => file === rel || file.startsWith(`${rel}/`))) {
        kept.push(rel)
        continue
      }
      if (!dryRun) rmSync(path, { recursive: true, force: true })
      removed.push(rel)
    }
  }
  return { removed, kept }
}

/**
 * What the install prints about retirement. Names every path, because a deletion the operator
 * cannot see is one they cannot undo — and names the spared ones too, since a name collision
 * the consumer never hears about is one they will hit again on every install.
 * @param {{ removed: string[], kept: string[] }} result output of `retireSkills`
 * @param {number} listed how many names the manifest retires
 * @param {boolean} dryRun
 * @returns {string} empty when there is nothing to say
 */
export function describeRetired({ removed, kept }, listed, dryRun) {
  const lines = []
  if (removed.length) {
    const suffix = dryRun ? ' (dry run — nothing removed)' : ''
    lines.push(
      `\nretired ${removed.length} installed skill(s)${suffix}:`,
      ...removed.map((path) => `    ${path}`),
    )
  } else if (listed && !kept.length) {
    lines.push(`\nretired: ${listed} name(s) in the manifest, none installed`)
  }
  if (kept.length) {
    lines.push(
      `\n⚠ ${kept.length} retired name(s) are tracked in git here and were left alone:`,
      ...kept.map((path) => `    ${path}`),
      "  These are yours, not the bundle's. Rename one if you want the bundle's back.",
    )
  }
  return lines.join('\n')
}
