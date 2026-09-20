// Where a file sits, read off its own path: which domain owns it and which runtime facet it
// belongs to, plus resolving one import specifier to the path it names. Split from
// domain-facet-boundaries.mts on length alone; that file applies policy to what this resolves.
import path from 'node:path'
import {
  type Facet,
  HARNESS_COMPOSITION_ROOT,
  SOURCE_ROOTS,
  TARGET_FACETS,
} from './domain-facet-policy.mts'

export type FacetAddress = { domain: string; facet: Facet }

export function normalized(filePath: string): string {
  return filePath.split(path.sep).join('/')
}

export function withoutExtension(filePath: string): string {
  return filePath.replace(/\.(?:[cm]?[jt]sx?|json)$/, '')
}

function isFacet(value: string): value is Facet {
  return TARGET_FACETS.has(value)
}

const TEMPORARY_HARNESS_MAIN_ALLOWANCES = new Set([
  'apps/desktop/src/harnesses/claude/integration/claude-driver-launch.ts',
  'apps/desktop/src/harnesses/claude/integration/live-feed-transcript.ts',
  'apps/desktop/src/harnesses/session-parity-harnesses.ts',
  'apps/desktop/src/harnesses/claude/compaction/compaction-hook.ts',
  'apps/desktop/src/harnesses/codex/compaction/bridge.ts',
])

function harnessFacet(parts: string[], harnesses: number, sourcePath: string): Facet {
  const file = parts.at(-1) ?? ''
  if (/(?:test|fixture|test-helper|fixtures)(?:\.|-)/.test(file)) return 'main'
  if (isWithin(sourcePath, HARNESS_COMPOSITION_ROOT)) return 'main'
  if (TEMPORARY_HARNESS_MAIN_ALLOWANCES.has(sourcePath)) return 'main'
  if (parts[harnesses + 2] === 'renderer') return 'renderer'
  return 'harness'
}

export function facetAddress(filePath: string): FacetAddress | null {
  const sourcePath = normalized(filePath)
  const parts = sourcePath.split('/')
  const domains = parts.indexOf('domains')
  if (domains >= 0) {
    const domain = parts[domains + 1]
    const facet = parts[domains + 2]
    if (!domain || !facet || !isFacet(facet)) return null
    return { domain, facet }
  }
  const platform = parts.indexOf('platform')
  if (platform >= 0) {
    const facet = parts[platform + 1]
    if (!facet || !isFacet(facet)) return null
    return { domain: 'platform', facet }
  }
  const source = parts.indexOf('src')
  const harnesses = parts.indexOf('harnesses')
  if (harnesses >= 0) {
    return {
      domain: 'harness',
      facet: harnessFacet(parts, harnesses, sourcePath),
    }
  }
  return parts[source + 1] === 'shared' ? { domain: 'shared', facet: 'shared' } : null
}

export function resolvedImport(sourcePath: string, specifier: string): string | null {
  if (specifier.startsWith('@/')) {
    return path.posix.join('apps/desktop/src', specifier.slice(2))
  }
  if (!specifier.startsWith('.')) return null
  return path.posix.normalize(path.posix.join(path.posix.dirname(sourcePath), specifier))
}

export function isWithin(filePath: string, directory: string): boolean {
  return filePath === directory || filePath.startsWith(`${directory}/`)
}

export function isLegacyRoot(targetPath: string): boolean {
  const root = targetPath.match(/^apps\/desktop\/src\/([^/.]+)/)?.[1]
  return root !== undefined && !SOURCE_ROOTS.has(root)
}
