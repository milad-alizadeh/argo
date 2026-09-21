import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

export type SourceFingerprintObservation = { kind: 'current' } | { kind: 'drifted'; reason: string }

// A plan names repository-relative source files. Reading them again is the authoritative drift
// check; agent-reported hashes are evidence, never the check itself.
export async function observeSourceFingerprints(
  projectRoot: string,
  fingerprints: Record<string, string>,
): Promise<SourceFingerprintObservation> {
  for (const [relativePath, expected] of Object.entries(fingerprints)) {
    const file = projectFile(projectRoot, relativePath)
    if (file === null) return { kind: 'drifted', reason: `Invalid source path: ${relativePath}` }
    try {
      const actual = createHash('sha256')
        .update(await readFile(file))
        .digest('hex')
      if (actual !== expected) return { kind: 'drifted', reason: `Source changed: ${relativePath}` }
    } catch {
      return { kind: 'drifted', reason: `Source is unavailable: ${relativePath}` }
    }
  }
  return { kind: 'current' }
}

function projectFile(projectRoot: string, relativePath: string): string | null {
  if (path.isAbsolute(relativePath)) return null
  const root = path.resolve(projectRoot)
  const candidate = path.resolve(root, relativePath)
  return candidate === root || candidate.startsWith(`${root}${path.sep}`) ? candidate : null
}
