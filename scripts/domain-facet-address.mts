// Where a file sits, read off its own path: which domain owns it and which runtime facet it
// belongs to, plus resolving one import specifier to the path it names. Split from
// domain-facet-boundaries.mts on length alone; that file applies policy to what this resolves.
import path from 'node:path'
import { SOURCE_ROOTS, TARGET_FACETS } from './domain-facet-policy.mts'

/** Where a file sits: which domain owns it, and which runtime it belongs to. */
export type FacetAddress = { domain: string; facet: string }

export function normalized(filePath: string): string {
  return filePath.split(path.sep).join('/')
}

export function withoutExtension(filePath: string): string {
  return filePath.replace(/\.(?:[cm]?[jt]sx?|json)$/, '')
}

function isHarnessImplementation(parts: string[], harnesses: number): boolean {
  const harness = parts[harnesses + 1]
  const kind = parts[harnesses + 2]
  const file = parts.at(-1) ?? ''
  if (harness === undefined || harness === 'composition') return false
  if (kind === 'drive') return !/(?:test|fixture|test-helper|fixtures)(?:\.|-)/.test(file)
  return kind === 'sessions' && !/(?:test|fixture|test-helper|fixtures)(?:\.|-)/.test(file)
}

export function facetAddress(filePath: string): FacetAddress | null {
  const parts = normalized(filePath).split('/')
  const domains = parts.indexOf('domains')
  if (domains >= 0) {
    const domain = parts[domains + 1]
    const facet = parts[domains + 2]
    if (!domain || !facet || !TARGET_FACETS.has(facet)) return null
    return { domain, facet }
  }
  const platform = parts.indexOf('platform')
  if (platform >= 0) {
    const facet = parts[platform + 1]
    if (!facet || !TARGET_FACETS.has(facet)) return null
    return { domain: 'platform', facet }
  }
  const source = parts.indexOf('src')
  const harnesses = parts.indexOf('harnesses')
  if (harnesses >= 0) {
    return {
      domain: 'harness',
      facet: isHarnessImplementation(parts, harnesses) ? 'harness' : 'main',
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
