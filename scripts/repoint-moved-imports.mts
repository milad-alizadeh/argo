// Repoints imports the folder restructure left pointing at a path that no longer exists. The
// typecheck cannot see most of them, because the test files that hold them sit outside every
// tsconfig include, so they surface only as `bun test` module-resolution errors.
//
// A moved file keeps its name, so the new home is found by basename. Where a name is ambiguous
// the candidate sharing the longest run of trailing path segments with the dead specifier wins,
// which is what makes `drive/session-drive-adapter` resolve to `drive/session/...` rather than to
// another harness's file of the same name. Anything still ambiguous is reported, never guessed.
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { ROOTS, SOURCE_ROOT, specifierPathFor, walk, withoutExtension } from './import-paths.mts'

const EXTENSIONS = ['', '.ts', '.tsx', '.mts', '/index.ts', '/index.tsx']

function resolves(specifierPath: string): boolean {
  return EXTENSIONS.some((extension) => {
    try {
      statSync(specifierPath + extension)
      return true
    } catch {
      return false
    }
  })
}

function sharedRun(left: string[], right: string[]): number {
  let shared = 0
  while (shared < left.length && shared < right.length && left[shared] === right[shared])
    shared += 1
  return shared
}

// A moved file usually keeps both ends of its path: the facet it belongs to (the head) and its own
// name (the tail). A restructure rewrites the middle. Scoring both ends is what separates one
// harness's `records.ts` from another's, where the tail alone cannot.
function affinity(candidate: string, wanted: string): number {
  const candidateSegments = candidate.split('/')
  const wantedSegments = wanted.split('/')
  const head = sharedRun(candidateSegments, wantedSegments)
  const tail = sharedRun([...candidateSegments].reverse(), [...wantedSegments].reverse())
  return head + tail
}

const allFiles = ROOTS.flatMap(walk)
const byBasename = new Map<string, string[]>()
for (const file of allFiles) {
  const base = path.basename(withoutExtension(file))
  byBasename.set(base, [...(byBasename.get(base) ?? []), file])
}

const dryRun = process.argv.includes('--dry')
let repointed = 0
let changedFiles = 0
const unresolved: string[] = []

for (const file of allFiles) {
  let contents = readFileSync(file, 'utf8')
  const original = contents
  const specifiers = [...contents.matchAll(/from '((?:\.\.?\/|@\/)[^']+)'/g)].map(
    (m) => m[1] as string,
  )
  for (const specifier of [...new Set(specifiers)]) {
    if (resolves(specifierPathFor(file, specifier))) continue
    // Scored as a repository path, not as written: an alias specifier shares no leading segment
    // with the path it stands for, which would throw away the head half of the affinity score.
    const wanted = withoutExtension(specifierPathFor(file, specifier))
    const candidates = byBasename.get(path.basename(wanted)) ?? []
    if (candidates.length === 0) {
      unresolved.push(`${file} -> ${specifier} (no file of that name)`)
      continue
    }
    const ranked = candidates
      .map((candidate) => ({ candidate, score: affinity(withoutExtension(candidate), wanted) }))
      .sort((a, b) => b.score - a.score)
    const best = ranked[0]
    if (best === undefined) continue
    if (ranked.length > 1 && ranked[1]?.score === best.score) {
      unresolved.push(
        `${file} -> ${specifier} (ambiguous: ${ranked.map((r) => r.candidate).join(', ')})`,
      )
      continue
    }
    const target = withoutExtension(best.candidate)
    const replacement = specifier.startsWith('@/')
      ? `@/${path.relative(SOURCE_ROOT, target)}`
      : (() => {
          const relative = path.relative(path.dirname(file), target)
          return relative.startsWith('.') ? relative : `./${relative}`
        })()
    contents = contents.split(`'${specifier}'`).join(`'${replacement}'`)
    repointed += 1
  }
  if (contents === original) continue
  changedFiles += 1
  if (!dryRun) writeFileSync(file, contents)
}

for (const line of unresolved) console.warn(`unresolved: ${line}`)
console.log(
  `${repointed} specifiers in ${changedFiles} files${dryRun ? ' (dry run, nothing written)' : ''}`,
)
if (unresolved.length > 0) console.log(`${unresolved.length} left alone, listed above`)
