import { builtinModules } from 'node:module'
import typescript from 'typescript'
import type { FacetAddress } from './domain-facet-address.mts'
import {
  facetAddress,
  isLegacyRoot,
  isWithin,
  normalized,
  resolvedImport,
  withoutExtension,
} from './domain-facet-address.mts'
import type { Facet } from './domain-facet-policy.mts'
import { ALLOWED_TARGETS, COMPOSITION_ROOTS, FACET_POLICIES } from './domain-facet-policy.mts'

/** One source file, as the caller read it off disk. */
export type SourceFile = { path: string; source: string }

/** One refused import. `targetFacet` is set only for the kinds that resolved a target. */
export type FacetViolation = {
  kind: string
  path: string
  sourceFacet: Facet
  specifier: string
  targetFacet?: string
}

const BUILT_INS = new Set(builtinModules.map((name) => name.replace(/^node:/, '')))

function isNodeImport(specifier: string): boolean {
  const name = specifier.replace(/^node:/, '')
  return specifier.startsWith('node:') || BUILT_INS.has(name)
}

function isElectronImport(specifier: string): boolean {
  return specifier === 'electron' || specifier.startsWith('electron/') || specifier === 'node-pty'
}

function isPublicDomainImport({
  sourcePath,
  source,
  target,
  targetPath,
}: {
  sourcePath: string
  source: FacetAddress
  target: FacetAddress
  targetPath: string
}): boolean {
  const sessionMain = target.domain === 'sessions' && target.facet === 'main'
  if (source.domain === 'harness' && source.facet === 'main' && sessionMain) {
    return true
  }
  if (sourcePath.startsWith('apps/desktop/src/harnesses/composition/') && sessionMain) {
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

function privilegedImport(facet: Facet, specifier: string, targetPath: string | null): boolean {
  const policy = FACET_POLICIES[facet]
  if (policy.refusesNode && isNodeImport(specifier)) return true
  if (policy.refusesElectron && isElectronImport(specifier)) return true
  if (policy.refusesReact && (specifier === 'react' || specifier.startsWith('react/'))) return true
  if (targetPath === null) return false
  return policy.privilegedRoots.some((directory) => isWithin(targetPath, directory))
}

function importViolation(
  sourcePath: string,
  sourceFacet: Facet,
  specifier: string,
): FacetViolation | null {
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
    isPublicDomainImport({ sourcePath, source, target, targetPath })
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

export function domainFacetViolations(files: SourceFile[]): FacetViolation[] {
  return files.flatMap((file) => {
    const sourcePath = normalized(file.path)
    const source = facetAddress(sourcePath)
    if (!source) return []
    return typescript.preProcessFile(file.source, true, true).importedFiles.flatMap((imported) => {
      const violation = importViolation(sourcePath, source.facet as Facet, imported.fileName)
      return violation ? [violation] : []
    })
  })
}
