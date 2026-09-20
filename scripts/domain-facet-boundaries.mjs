import { builtinModules } from 'node:module'
import path from 'node:path'
import typescript from 'typescript'
import {
  ALLOWED_TARGETS,
  COMPOSITION_ROOTS,
  FACET_POLICIES,
  HARNESS_COMPOSITION_ROOT,
  SOURCE_ROOTS,
  TARGET_FACETS,
} from './domain-facet-policy.mjs'

// Modules under harnesses/ that surfaced as violations the day the harness facet inverted
// (#2505): production, non-test code that reaches Sessions main or platform main directly.
// Each is a temporary allowance, not a rule: it keeps the pre-inversion main facet for this one
// file so the gate stays green. A later wave must fix the module and remove its entry.
const TEMPORARY_HARNESS_MAIN_ALLOWANCES = new Set([
  'apps/desktop/src/harnesses/claude/integration/claude-driver-launch.ts',
  'apps/desktop/src/harnesses/claude/integration/live-feed-transcript.ts',
  'apps/desktop/src/harnesses/session-parity-harnesses.ts',
  'apps/desktop/src/harnesses/claude/compaction/compaction-hook.ts',
  'apps/desktop/src/harnesses/codex/compaction/bridge.ts',
])

const BUILT_INS = new Set(builtinModules.map((name) => name.replace(/^node:/, '')))

function normalized(filePath) {
  return filePath.split(path.sep).join('/')
}
function withoutExtension(filePath) {
  return filePath.replace(/\.(?:[cm]?[jt]sx?|json)$/, '')
}
function isTestOrFixtureFile(file) {
  return /(?:test|fixture|test-helper|fixtures)(?:\.|-)/.test(file)
}
// Every path under harnesses/ is the harness facet by default. The declared exceptions are the
// composition root (it wires Harnesses into the app, so it takes the main facet, like
// apps/desktop/src/main) and a Harness's own renderer/ directory, which takes the renderer
// facet. A test or fixture file keeps its long-standing free pass regardless of directory.
function harnessFacet(parts, harnesses, sourcePath) {
  const file = parts.at(-1) ?? ''
  if (isTestOrFixtureFile(file)) return 'main'
  if (isWithin(sourcePath, HARNESS_COMPOSITION_ROOT)) return 'main'
  if (TEMPORARY_HARNESS_MAIN_ALLOWANCES.has(sourcePath)) return 'main'
  if (parts[harnesses + 2] === 'renderer') return 'renderer'
  return 'harness'
}
function facetAddress(filePath) {
  const sourcePath = normalized(filePath)
  const parts = sourcePath.split('/')
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
    return { domain: 'harness', facet: harnessFacet(parts, harnesses, sourcePath) }
  }
  return parts[source + 1] === 'shared' ? { domain: 'shared', facet: 'shared' } : null
}
function resolvedImport(sourcePath, specifier) {
  if (specifier.startsWith('@/')) {
    return path.posix.join('apps/desktop/src', specifier.slice(2))
  }
  if (!specifier.startsWith('.')) return null
  return path.posix.normalize(path.posix.join(path.posix.dirname(sourcePath), specifier))
}
function isNodeImport(specifier) {
  const name = specifier.replace(/^node:/, '')
  return specifier.startsWith('node:') || BUILT_INS.has(name)
}

function isElectronImport(specifier) {
  return specifier === 'electron' || specifier.startsWith('electron/') || specifier === 'node-pty'
}

function isWithin(filePath, directory) {
  return filePath === directory || filePath.startsWith(`${directory}/`)
}

function isLegacyRoot(targetPath) {
  const root = targetPath.match(/^apps\/desktop\/src\/([^/.]+)/)?.[1]
  return root !== undefined && !SOURCE_ROOTS.has(root)
}

function isPublicDomainImport({ source, target, targetPath }) {
  const sessionMain = target.domain === 'sessions' && target.facet === 'main'
  // The composition root, the temporary allowances, and test/fixture files all carry the main
  // facet (see harnessFacet), so this branch already covers them; nothing else under harnesses/
  // gets a facet-wide free pass into Sessions main.
  if (source.domain === 'harness' && source.facet === 'main' && sessionMain) {
    return true
  }
  if (
    source.domain === target.domain ||
    target.domain === 'platform' ||
    target.domain === 'shared'
  ) {
    return true
  }
  if (target.facet === 'contract') return true
  return (
    (target.facet === 'main' && targetPath.endsWith('/main/port')) ||
    (target.facet === 'renderer' && targetPath.endsWith('/renderer/port'))
  )
}

function privilegedImport(facet, specifier, targetPath) {
  const policy = FACET_POLICIES[facet]
  if (policy.refusesNode && isNodeImport(specifier)) return true
  if (policy.refusesElectron && isElectronImport(specifier)) return true
  if (policy.refusesReact && (specifier === 'react' || specifier.startsWith('react/'))) return true
  if (targetPath === null) return false
  return policy.privilegedRoots.some((directory) => isWithin(targetPath, directory))
}

function importViolation(sourcePath, sourceFacet, specifier) {
  const shared = { path: sourcePath, sourceFacet, specifier }
  const source = facetAddress(sourcePath)
  const targetPath = resolvedImport(sourcePath, specifier)
  if (privilegedImport(sourceFacet, specifier, targetPath)) {
    return { kind: 'privileged-import', ...shared }
  }
  if (!targetPath) return null
  if (COMPOSITION_ROOTS.has(withoutExtension(targetPath))) {
    return { kind: 'composition-root', ...shared }
  }
  if (isLegacyRoot(targetPath)) return { kind: 'legacy-root', ...shared }
  const target = facetAddress(targetPath)
  const crossDomainPublic =
    source &&
    target &&
    source.domain !== target.domain &&
    (target.domain !== 'platform' || targetPath.endsWith('/main/port')) &&
    isPublicDomainImport({ source, target, targetPath })
  if (
    source &&
    target &&
    source.domain !== target.domain &&
    target.domain !== 'platform' &&
    !crossDomainPublic
  ) {
    return { kind: 'private-domain-import', ...shared, targetFacet: target.facet }
  }
  if (crossDomainPublic) return null
  if (source?.domain === 'harness' && target?.domain === 'harness') return null
  if (!target || ALLOWED_TARGETS[sourceFacet].has(target.facet)) return null
  return { kind: 'runtime-facet', ...shared, targetFacet: target.facet }
}

export function domainFacetViolations(files) {
  return files.flatMap((file) => {
    const sourcePath = normalized(file.path)
    const source = facetAddress(sourcePath)
    if (!source) return []
    return typescript.preProcessFile(file.source, true, true).importedFiles.flatMap((imported) => {
      const violation = importViolation(sourcePath, source.facet, imported.fileName)
      return violation ? [violation] : []
    })
  })
}
