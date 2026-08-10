// Uninstall the skills the manifest RETIRED — renamed away, split, or deleted.
//
// `skills add` only ever adds, so a name removed from the lock stays installed and keeps
// advertising itself. Two skills then compete for the same prompts and the retired one
// sometimes wins, which is the failure this exists to prevent: the rename looked done and the
// old behaviour was still reachable.
//
// It deletes only names the manifest lists in `retired`, never names merely absent from
// `skills`. Nothing under a skills directory is git-tracked in this repo, so the
// tracked-in-git test that protects a consumer's own skills reports none — inferring orphans
// from absence would take out anything installed out of band (graphify installs its own skill;
// a project may hand-write one). An explicit list is the only safe signal, and it doubles as
// the rename ledger.

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
 * @param {string} root repo root
 * @param {string[]} retired names from the manifest's `retired` array
 * @param {boolean} dryRun report what would go without removing it
 * @returns {string[]} repo-relative paths removed (or that would be)
 */
export function retireSkills(root, retired, dryRun) {
  const removed = []
  for (const name of retired) {
    for (const dir of SKILL_DIRS) {
      const path = resolve(root, dir, name)
      // lstat, not existsSync: `skills add` publishes symlinks, and a link whose payload is
      // already gone still shadows the name.
      try {
        lstatSync(path)
      } catch {
        continue
      }
      if (!dryRun) rmSync(path, { recursive: true, force: true })
      removed.push(`${dir}/${name}`)
    }
  }
  return removed
}

/**
 * What the install prints about retirement. Names every path, because a deletion the operator
 * cannot see is one they cannot undo.
 * @param {string[]} removed output of `retireSkills`
 * @param {number} listed how many names the manifest retires
 * @param {boolean} dryRun
 * @returns {string} empty when there is nothing to say
 */
export function describeRetired(removed, listed, dryRun) {
  if (removed.length) {
    const suffix = dryRun ? ' (dry run — nothing removed)' : ''
    return [
      `\nretired ${removed.length} installed skill(s)${suffix}:`,
      ...removed.map((path) => `    ${path}`),
    ].join('\n')
  }
  return listed ? `\nretired: ${listed} name(s) in the manifest, none installed` : ''
}
