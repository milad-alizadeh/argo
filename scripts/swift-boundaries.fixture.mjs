// The synthetic tree both swift-boundaries suites run against, and the assertions' own scaffolding.
//
// A synthetic tree rather than the real one, so an expected failure is a failure of the GATE and
// not of the app — and shared rather than copied, because two trees would drift into two ideas of
// what a repository the gate passes looks like.
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SCRIPT = path.join(REPO_ROOT, 'scripts/swift-boundaries.sh')
export const ENGINE = 'apps/macOS/Packages/ArgoEngine/Sources/ArgoEngine/Hub'
export const SHELL = 'apps/macOS/Packages/ArgoUI/Sources/ArgoUI/Shell'

let failures = 0
export function check(name, fn) {
  try {
    fn()
    console.log(`  ok   ${name}`)
  } catch (err) {
    failures += 1
    console.error(`  FAIL ${name}\n       ${err.message}`)
  }
}

export function report(suite) {
  if (failures) {
    console.error(`\n${failures} ${suite} test(s) failed`)
    process.exit(1)
  }
  console.log(`  ${suite}: all checks passed`)
}

// `internalOnly` is the trap: keyword-less at struct indentation, and internal to the engine, so
// ArgoUI cannot see it and the gate must not demand it. `HubSession`'s own `resumeID` is this.
export const HUB_SESSION = `public struct HubSession: Equatable {
    public let id: String
    public internal(set) var liveness: Int = 0
    private var hidden: Int = 0
    var internalOnly: Int { 0 }
}
`
export const HUB_MODE = `public extension HubSession {
    var mode: Int { 0 }
}
`
export const PROJECTION = `extension CockpitPresentation.Session {
    /// not-projected: liveness — an input to a fold whose result lands instead.
    init(observed session: HubSession) {
        self.init(id: session.id, mode: session.mode)
    }
}
`
// Edge 6 reads its ratchet off the SwiftLint config, so the config is one of its subjects.
export const SWIFTLINT = `function_parameter_count:
  # RATCHET initializer-parameter-count: 4
  error: 4
`

// A fresh tree per case: the cases mutate it, and a leaked mutation would make the next one lie.
export function tree(files = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'argo-boundaries-'))
  const written = {
    [`${ENGINE}/HubSession.swift`]: HUB_SESSION,
    [`${ENGINE}/HubSession+Mode.swift`]: HUB_MODE,
    [`${SHELL}/CockpitPresentation+Hub.swift`]: PROJECTION,
    'apps/macOS/.swiftlint.yml': SWIFTLINT,
    'apps/macOS/Argo/ArgoApp.swift': '@main struct ArgoApp {}\n',
    ...files,
  }
  for (const [relative, contents] of Object.entries(written)) {
    if (contents === null) continue
    const file = path.join(root, relative)
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, contents)
  }
  return root
}

export function run(root) {
  const result = spawnSync('/bin/sh', [SCRIPT], { cwd: root, encoding: 'utf8' })
  rmSync(root, { recursive: true, force: true })
  return { status: result.status, output: `${result.stdout}${result.stderr}` }
}

// A declaration added just before a file's closing brace, which in both fixtures is the
// declaration's enclosing scope.
export const withFact = (source, declaration) => source.replace(/^}/m, `${declaration}\n}`)
export const projection = (contents) => ({ [`${SHELL}/CockpitPresentation+Hub.swift`]: contents })
