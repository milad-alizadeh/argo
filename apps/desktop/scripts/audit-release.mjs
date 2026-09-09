#!/usr/bin/env node
// `node scripts/audit-release.mjs <directory of downloaded release assets>` — the backstop's
// reading of a release that is already published (ADR-0036, #1809).
//
// It prints one JSON object and exits 0 whatever it finds. The workflow decides what to do with
// the answer, because the order matters there: file the issue first, then delete the release, and
// the delete destroys the evidence.
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { releaseAudit } from './release-audit.mjs'
import { artifactDigests, VERDICT_FILENAME } from './release-verdict.mjs'

const directory = process.argv[2]
if (!directory) {
  process.stderr.write('usage: audit-release.mjs <directory of downloaded release assets>\n')
  process.exit(2)
}

const files = readdirSync(directory).map((name) => path.join(directory, name))
const verdictPath = files.find((file) => path.basename(file) === VERDICT_FILENAME)

// A verdict that is present but unreadable is a missing one: nothing can be gated on a document
// nobody can parse.
let verdict = null
if (verdictPath) {
  try {
    verdict = JSON.parse(readFileSync(verdictPath, 'utf8'))
  } catch (error) {
    process.stdout.write(
      `${JSON.stringify({ case: 'verdict missing', reasons: [`release-verdict.json could not be read: ${error.message}`], digests: [] })}\n`,
    )
    process.exit(0)
  }
}

const digests = artifactDigests(files)
const audit = releaseAudit(verdict, digests)
process.stdout.write(`${JSON.stringify({ ...audit, digests, verdict })}\n`)
