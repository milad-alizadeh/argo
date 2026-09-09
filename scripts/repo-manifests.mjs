// Where the repo's own package manifests are, derived rather than listed.
//
// Shared by the Node-pin suites (#1777) because both of them need the same answer and the
// duplication gate is right to refuse two copies of it: at 1% threshold, the copied preamble was
// the 0.01% that tipped it. The deeper reason is that a LIST of manifests is the bug those suites
// exist to prevent — a fifth workspace lands, the list does not grow, and a check that reads
// "every manifest" quietly reads four of five.
//
// `git ls-files` and not a directory walk: a manifest git does not track reaches no clone and no
// CI runner, so it is not part of the repo's contract with anybody.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export const read = (file) => readFileSync(path.join(ROOT, file), 'utf8')
export const readJson = (file) => JSON.parse(read(file))

export const tracked = (...patterns) =>
  execFileSync('git', ['ls-files', '-z', ...patterns], { cwd: ROOT, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean)

// The root manifest plus one per workspace. The globs are `packages/*` and `apps/*`, so a
// workspace manifest is always exactly two segments deep; the filter keeps this honest by
// comparing the top segment against the globs the root actually declares, rather than assuming
// which two directories those are.
export const MANIFESTS = [
  'package.json',
  ...tracked('*/*/package.json').filter((file) =>
    (readJson('package.json').workspaces ?? []).some(
      (glob) => glob.split('/')[0] === file.split('/')[0],
    ),
  ),
]
