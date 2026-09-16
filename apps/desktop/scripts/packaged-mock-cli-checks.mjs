// Refuses a packaged Argo.app that carries a mock CLI (#2324). The mocks run from source beside the
// e2e flows, so `build` never hashes them; one inside the bundle would make every mock edit a rebuild.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import asar from '@electron/asar'
import {
  MOCK_CLAUDE_PROCESS_TITLE,
  MOCK_CODEX_PROCESS_TITLE,
} from '../mocks/cli/mock-cli-process-titles.mts'
import { asarEntryList, resourcesDir } from './packaged-pty-checks.mjs'

const MOCK_CLIS = [
  { cli: 'claude', title: MOCK_CLAUDE_PROCESS_TITLE },
  { cli: 'codex', title: MOCK_CODEX_PROCESS_TITLE },
]

function* unpackedFiles(directory) {
  let entries
  try {
    entries = readdirSync(directory, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) yield* unpackedFiles(entryPath)
    else if (entry.isFile()) yield entryPath
  }
}

// Every file in the archive and beside it, as bytes: a bundler keeps a string literal whatever it renames.
function* bundledFiles(appPath) {
  const archive = path.join(resourcesDir(appPath), 'app.asar')
  // A missing archive is `packagedPtyFailures`'s finding, and naming it twice buries it.
  if (!existsSync(archive)) return
  for (const entry of asarEntryList(archive)) {
    const stats = asar.statFile(archive, entry, false)
    if ('size' in stats && !stats.unpacked)
      yield { name: `app.asar/${entry}`, contents: asar.extractFile(archive, entry, false) }
  }
  const unpacked = `${archive}.unpacked`
  for (const file of unpackedFiles(unpacked))
    yield {
      name: `app.asar.unpacked/${path.relative(unpacked, file)}`,
      contents: readFileSync(file),
    }
}

// A source copy keeps its path but not the title string, which only its import resolves to.
const MOCK_SOURCE_PATH = /(^|\/)mocks\/cli\//

export function mockCliFailures(appPath) {
  const failures = []
  for (const { name, contents } of bundledFiles(appPath)) {
    if (MOCK_SOURCE_PATH.test(name)) failures.push(`a mock CLI file is in the package, at ${name}`)
    for (const { cli, title } of MOCK_CLIS)
      if (contents.includes(title))
        failures.push(`the mock ${cli} CLI is in the package, in ${name}`)
  }
  return failures
}
