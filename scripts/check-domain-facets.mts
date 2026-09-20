import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { domainFacetViolations, type SourceFile } from './domain-facet-boundaries.mts'

function normalized(filePath: string): string {
  return filePath.split(path.sep).join('/')
}

async function sourceFiles(directory: string): Promise<SourceFile[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files: SourceFile[] = []
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await sourceFiles(entryPath)))
    else if (
      /\.[cm]?[jt]sx?$/.test(entry.name) &&
      !entry.name.includes('.test.') &&
      !entry.name.includes('.stories.') &&
      entry.name !== 'harness-fixtures.ts' &&
      entry.name !== 'roster-fixtures.ts'
    ) {
      files.push({
        path: normalized(path.relative(process.cwd(), entryPath)),
        source: await readFile(entryPath, 'utf8'),
      })
    }
  }
  return files
}

const source = path.join(import.meta.dirname, '../apps/desktop/src')
const violations = domainFacetViolations(await sourceFiles(source))
for (const violation of violations) {
  console.error(
    `${violation.path}: ${violation.sourceFacet} cannot import ${violation.specifier} (${violation.kind})`,
  )
}
if (violations.length > 0) process.exitCode = 1
