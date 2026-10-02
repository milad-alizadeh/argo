import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const repositoryRoot = path.resolve(import.meta.dirname, '../../..')
const sourceRoot = path.join(import.meta.dirname, '../src')

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)
    return entry.isDirectory() ? sourceFiles(entryPath) : [entryPath]
  })
}

// Turborepo reads `*` in an environment entry as "any characters" and everything else literally.
function matchesTurboPattern(pattern: string, name: string): boolean {
  const escaped = pattern.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
  return new RegExp(`^${escaped.join('.*')}$`).test(name)
}

describe('root turbo.json environment passthrough', () => {
  test('forwards every ARGO_ variable that app source names, so `bun run dev` reaches Electron', () => {
    const turbo = JSON.parse(readFileSync(path.join(repositoryRoot, 'turbo.json'), 'utf8')) as {
      globalPassThroughEnv: string[]
    }
    const named = new Set(
      sourceFiles(sourceRoot).flatMap(
        (file) => readFileSync(file, 'utf8').match(/\bARGO_[A-Z0-9_]+/g) ?? [],
      ),
    )
    const dropped = [...named].filter(
      (name) => !turbo.globalPassThroughEnv.some((pattern) => matchesTurboPattern(pattern, name)),
    )

    expect(named.size).toBeGreaterThan(0)
    expect(dropped.sort()).toEqual([])
  })
})
