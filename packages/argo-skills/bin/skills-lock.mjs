// Where the bundle manifest lives and how its entries group by source, so `scaffold.mjs`
// (installs from it) doesn't re-derive them.
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// This file sits at <argo-root>/packages/argo-skills/bin; the lock is the repo root's, so it
// doubles as Argo's own install record (dogfooded) rather than a copy inside the package.
export const LOCK_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'skills-lock.json',
)

/**
 * Group manifest entries by the source that publishes them. A name appears once in a lock, so
 * the source behind it is unambiguous and no install can silently overwrite another's skill.
 * @param {{ skills: Record<string, { source: string }> }} lock
 * @param {string[]} names — must all be present in `lock.skills`
 * @returns {Map<string, string[]>} source -> the names to install from it
 */
export function groupBySource(lock, names) {
  const bySource = new Map()
  for (const name of names) {
    const { source } = lock.skills[name]
    bySource.set(source, [...(bySource.get(source) ?? []), name])
  }
  return bySource
}
