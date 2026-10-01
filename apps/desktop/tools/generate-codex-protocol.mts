import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const output = fileURLToPath(
  new URL('../src/harnesses/codex/app-server/protocol-generated/', import.meta.url),
)
const temporary = mkdtempSync(path.join(tmpdir(), 'argo-codex-protocol-'))
const roots = [
  'v2/ThreadItem.ts',
  'v2/ThreadReadResponse.ts',
  'v2/ThreadListResponse.ts',
  'v2/ThreadListParams.ts',
  'v2/ThreadReadParams.ts',
  'v2/ThreadTurnsListParams.ts',
  'v2/ThreadTurnsListResponse.ts',
  'v2/AgentMessageDeltaNotification.ts',
  'v2/ReasoningSummaryTextDeltaNotification.ts',
  'v2/TurnPlanUpdatedNotification.ts',
  'v2/SkillsListParams.ts',
  'v2/SkillMetadata.ts',
  'v2/ConfigReadParams.ts',
  'v2/ConfigValueWriteParams.ts',
  'v2/ConfigWriteResponse.ts',
  'v2/ConfigLayer.ts',
  'v2/ManagedHooksRequirements.ts',
]
const destinationPath = (relativePath: string) =>
  relativePath.replace(/[^/]+\.ts$/, (name) =>
    name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase(),
  )

try {
  execFileSync('codex', ['app-server', 'generate-ts', '--out', temporary], { stdio: 'inherit' })
  const files = new Set<string>()
  const visit = (relativePath: string) => {
    if (files.has(relativePath)) return
    files.add(relativePath)
    const source = readFileSync(path.join(temporary, relativePath), 'utf8')
    for (const [, dependency] of source.matchAll(/from "([^"]+)"/g)) {
      if (dependency === undefined) continue
      visit(path.normalize(path.join(path.dirname(relativePath), `${dependency}.ts`)))
    }
  }
  for (const root of roots) visit(root)
  rmSync(output, { recursive: true, force: true })
  for (const relativePath of files) {
    const renamedPath = destinationPath(relativePath)
    const destination = path.join(output, renamedPath)
    mkdirSync(path.dirname(destination), { recursive: true })
    const source = readFileSync(path.join(temporary, relativePath), 'utf8').replace(
      /from "([^"]+)"/g,
      (_match, dependency: string) => {
        const dependencyPath = path.normalize(
          path.join(path.dirname(relativePath), `${dependency}.ts`),
        )
        const relativeImport = path
          .relative(path.dirname(renamedPath), destinationPath(dependencyPath))
          .replace(/\.ts$/, '')
          .split(path.sep)
          .join('/')
        return `from "${relativeImport.startsWith('.') ? relativeImport : `./${relativeImport}`}"`
      },
    )
    writeFileSync(destination, source)
  }
  execFileSync('bunx', ['biome', 'check', '--write', output], { stdio: 'inherit' })
  process.stdout.write(`Copied ${files.size} Codex app-server type declarations.\n`)
} finally {
  rmSync(temporary, { recursive: true, force: true })
}
