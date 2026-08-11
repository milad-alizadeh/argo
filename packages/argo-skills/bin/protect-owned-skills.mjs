// Protect a consumer's own skills from `skills add`.
//
// `skills add` publishes a skill by replacing `<agent>/skills/<name>/` with a symlink into
// its vendored payload. When the target repo already had a skill of that name, the replaced
// directory is *deleted* — and a project-specific skill is exactly the kind of file a
// consumer cannot get back, because nothing warned them it was about to go.
//
// Tracked-in-git is what separates the two populations: vendored payloads land in
// gitignored directories, so anything git knows about under a skills directory is the
// repo's own. Snapshot that set before installing, restore whatever the install took, and
// say so loudly — a silent restore leaves the consumer believing the collision never
// happened, and the next `skills add` finds the same trap.

import { spawnSync } from 'node:child_process'
import { lstatSync, unlinkSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

// Every location `skills add` publishes into for the agents it treats as universal.
export const SKILL_DIRS = ['.claude/skills', '.agents/skills', '.cursor/skills', '.codex/skills']

function git(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
  return result.status === 0 ? result.stdout : null
}

function lstatOrNull(path) {
  try {
    return lstatSync(path)
  } catch {
    return null
  }
}

/**
 * The repo's own skill files: everything git tracks under a skills directory.
 * Returns an empty list outside a git repo — there is no way to tell ownership there,
 * and guessing would restore files the consumer never had.
 * @param {string} root repo root
 * @returns {string[]} repo-relative paths
 */
export function snapshotOwnedSkills(root) {
  const tracked = git(root, ['ls-files', '-z', '--', ...SKILL_DIRS])
  if (tracked === null) return []
  return tracked.split('\0').filter(Boolean)
}

// The nearest ancestor directory that the install turned into a symlink, or null. Restoring
// through one would write into the vendored payload instead of the repo, so it goes first.
function symlinkedAncestor(root, relative) {
  let dir = dirname(relative)
  while (dir && dir !== '.') {
    if (lstatOrNull(resolve(root, dir))?.isSymbolicLink()) return dir
    dir = dirname(dir)
  }
  return null
}

/**
 * Restore every snapshotted file the install replaced or removed. Content comes from the
 * index, so a staged edit survives; an unstaged one was already gone when the directory was
 * deleted, and this recovers the most recent version git holds.
 * @param {string} root repo root
 * @param {string[]} snapshot output of `snapshotOwnedSkills`, taken before installing
 * @returns {string[]} the paths actually restored
 */
export function restoreOwnedSkills(root, snapshot) {
  const restored = []
  for (const relative of snapshot) {
    const link = symlinkedAncestor(root, relative)
    if (!link && lstatOrNull(resolve(root, relative))) continue
    if (link) unlinkSync(resolve(root, link))
    if (git(root, ['checkout', '--', relative]) !== null) restored.push(relative)
  }
  return restored
}

/**
 * The warning shown when a restore happened. Names the files, because the consumer has to
 * decide whether they wanted their own skill or the bundle's — this tool cannot.
 * @param {string[]} restored
 * @returns {string}
 */
export function describeRestore(restored) {
  return [
    `\n⚠ ${restored.length} skill file(s) this repo owns were replaced by the bundle and have been restored:`,
    ...restored.map((path) => `    ${path}`),
    '  The bundle ships a skill under the same name. Yours wins by default — rename one of',
    '  the two if you want both, and re-run.',
  ].join('\n')
}
