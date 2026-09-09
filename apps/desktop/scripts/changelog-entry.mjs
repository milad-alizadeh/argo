#!/usr/bin/env node
// `node scripts/changelog-entry.mjs <version> [--changelog <file>]` — prints the release notes for
// one version, read out of the committed changelog.
//
// The notes are tracked rather than typed at dispatch, which is what lets a release be rebuilt
// without retyping them (ADR-0036). Writing the entry is `/release-argo`'s job (#1808); reading it
// is the release workflow's, and a version with no entry stops the release here, before anything
// is built.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

export const CHANGELOG_PATH = path.resolve(import.meta.dirname, '..', 'CHANGELOG.md')

const HEADING = /^##\s+/

// A version heading may carry a date or a link after the number, and the next `##` ends the
// section whatever it says. The number is compared as a whole word: `1.2.1` must not be handed
// `1.2.10`'s notes.
function headingVersion(line) {
  // Whitespace only, so a prerelease version keeps its `-rc.1`.
  return line.replace(HEADING, '').trim().split(/\s+/)[0]
}

export function changelogEntry(changelog, version) {
  const lines = changelog.split('\n')
  const start = lines.findIndex((line) => HEADING.test(line) && headingVersion(line) === version)
  if (start === -1) return null
  const rest = lines.slice(start + 1)
  const end = rest.findIndex((line) => HEADING.test(line))
  const body = (end === -1 ? rest : rest.slice(0, end)).join('\n').trim()
  return body === '' ? null : body
}

if (import.meta.main) {
  const args = process.argv.slice(2)
  const version = args.find((argument) => !argument.startsWith('--'))
  const changelogPath = args.includes('--changelog')
    ? args[args.indexOf('--changelog') + 1]
    : CHANGELOG_PATH
  if (!version) {
    process.stderr.write('usage: changelog-entry.mjs <version> [--changelog <file>]\n')
    process.exit(2)
  }
  let changelog
  try {
    changelog = readFileSync(changelogPath, 'utf8')
  } catch {
    process.stderr.write(`no changelog at ${changelogPath}. \`/release-argo\` (#1808) writes it.\n`)
    process.exit(1)
  }
  const entry = changelogEntry(changelog, version)
  if (entry === null) {
    process.stderr.write(
      `${changelogPath} has no entry for ${version}. Write one before releasing it.\n`,
    )
    process.exit(1)
  }
  process.stdout.write(`${entry}\n`)
}
