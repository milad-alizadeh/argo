// The device code, PKCE verifier and grant for a Harness sign-in live in the main-process actor
// for the whole attempt (#2579's "Replacement cleanup": keep no second source of sign-in state).
// A renderer file that reaches for browser storage would start holding that state itself, so this
// gate fails loudly the moment one does, rather than waiting for a reload to lose an attempt.
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'

const RENDERER_ROOT = path.join(import.meta.dirname, 'renderer')
const FORBIDDEN = ['localStorage', 'sessionStorage', 'indexedDB']

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map((entry) => {
      const entryPath = path.join(directory, entry.name)
      if (entry.isDirectory()) return sourceFiles(entryPath)
      return entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') ? [entryPath] : []
    }),
  )
  return files.flat()
}

test('the Harness sign-in renderer holds no state of its own', async () => {
  for (const file of await sourceFiles(RENDERER_ROOT)) {
    const contents = await readFile(file, 'utf8')
    for (const forbidden of FORBIDDEN) {
      assert.ok(
        !contents.includes(forbidden),
        `${path.relative(RENDERER_ROOT, file)} uses ${forbidden}; a Harness sign-in attempt lives in the main process, never in browser storage`,
      )
    }
  }
})
