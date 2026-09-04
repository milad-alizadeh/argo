// The synthetic tree both swift-boundaries suites run against, and the assertions' own scaffolding.
//
// A synthetic tree rather than the real one, so an expected failure is a failure of the GATE and
// not of the app — and shared rather than copied, because two trees would drift into two ideas of
// what a repository the gate passes looks like.
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const ENGINE = 'apps/macOS/Packages/ArgoEngine/Sources/ArgoEngine/Hub'
export const SHELL = 'apps/macOS/Packages/ArgoUI/Sources/ArgoUI/Shell'
// Edge 7's two subjects: the dev-tool targets beside ArgoUI, which the edge checks the direction
// of. Named files rather than empty directories, because git carries no empty one and the edge
// reports a missing target rather than passing over it.
export const SPECIMENS = 'apps/macOS/Packages/ArgoUI/Sources/ArgoSpecimens'
export const FIXTURES = 'apps/macOS/Packages/ArgoUI/Sources/ArgoFixtures'
// The file edge 6's cases put their subject in, and the config it reads its cap off.
export const ACTIONS = `${SHELL}/CockpitActions.swift`
export const CONFIG = 'apps/macOS/.swiftlint.yml'
export const wideInit = (count) =>
  `struct CockpitActions {\n    init(\n${Array.from(
    { length: count },
    (_, i) => `        slot${i}: Int,\n`,
  ).join('')}    ) {}\n}\n`
// A struct with no written init, so Swift synthesizes the memberwise one — the shape a regroup
// produces by construction and the shape SwiftLint and the written-init scanner both miss.
export const wideStruct = (count, extra = '') =>
  `struct Picked {\n${Array.from({ length: count }, (_, i) => `    let slot${i}: Int\n`).join(
    '',
  )}${extra}}\n`
export const CONTRACT = 'apps/macOS/Packages/ArgoDesign/Sources/ArgoDesign'
export const ATOMS = 'apps/macOS/Packages/ArgoDesign/Sources/ArgoAtoms'
export const PROSE = 'apps/macOS/Packages/ArgoDesign/Sources/ProseText'
// The renderer's headless half, edge 2's second subject beside the engine (#1087).
export const MERMAID = 'apps/macOS/Packages/ArgoMermaid/Sources/MermaidLayout'
export const MERMAID_VIEW = 'apps/macOS/Packages/ArgoMermaid/Sources/MermaidView'
// The map's, edge 2's third — split from its own drawing half for the same reason (#1143).
export const ATLAS = 'apps/macOS/Packages/ArgoAtlas/Sources/AtlasLayout'
export const ATLAS_VIEW = 'apps/macOS/Packages/ArgoAtlas/Sources/AtlasView'
export const ALLOW = 'scripts/design-tokens-swift-allow.txt'

// Edge 7 calls a script of its own, and that script reads its allowlist from beside itself. Both
// are copied into the tree so a case can state the allowlist the way it states a source file —
// and so no case can pass or fail on what the REAL allowlist happens to hold today.
const SCRIPTS = {
  'scripts/swift-boundaries.sh': null,
  'scripts/check-design-tokens-swift.sh': null,
}
for (const name of Object.keys(SCRIPTS)) {
  SCRIPTS[name] = readFileSync(path.join(REPO_ROOT, name), 'utf8')
}

// The contract's own module, where a literal colour is the point. Present in every tree: edge 7
// reports a scope it cannot find rather than passing a tree it never looked at.
export const CONTRACT_FILE = `public struct ArgoColor {
    public static let accent = Color(red: 0.24, green: 0.61, blue: 1)
}
`

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
// The value the mapping assembles. Its init body is the second hand a fact passes through, and the
// second place it can be dropped on the wrong slot.
export const PROJECTED = `public extension CockpitPresentation {
    struct Session {
        public init(id: String, chain: Chain) {
            self.id = id
            self.mode = chain.mode
        }
    }
}
`
// The grouped values the projected init takes. `Chain` groups its own parameters again, so its
// init body is a THIRD hand — a swap here reaches the two files above already made.
export const VALUES = `public extension CockpitPresentation.Session {
    struct Chain {
        public init(program: Program) {
            self.mode = program.mode
        }
    }
}
`
// Edge 6 reads its cap off the SwiftLint config, so the config is one of its subjects. It reads the
// rule's OWN `error:`, and grandfathers only what a `# INIT:` line beside it names.
export const SWIFTLINT = `function_parameter_count:
  # RATCHET initializer-parameter-count — the list is the ratchet; the cap is the number below.
  error: 4
`
// The same config with grandfathered entries added, one per line.
export const swiftlint = (...entries) =>
  SWIFTLINT + entries.map((entry) => `  # INIT: ${entry}\n`).join('')

// A fresh tree per case: the cases mutate it, and a leaked mutation would make the next one lie.
export function tree(files = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'argo-boundaries-'))
  const written = {
    [`${ENGINE}/HubSession.swift`]: HUB_SESSION,
    [`${ENGINE}/HubSession+Mode.swift`]: HUB_MODE,
    [`${SHELL}/CockpitPresentation+Hub.swift`]: PROJECTION,
    [`${SHELL}/CockpitPresentation+Session.swift`]: PROJECTED,
    [`${SHELL}/CockpitPresentation+SessionValues.swift`]: VALUES,
    'apps/macOS/.swiftlint.yml': SWIFTLINT,
    'apps/macOS/Argo/ArgoApp.swift': '@main struct ArgoApp {}\n',
    [`${CONTRACT}/ArgoColor.swift`]: CONTRACT_FILE,
    [`${ATOMS}/ArgoRule.swift`]: 'public struct ArgoRule { public init() {} }\n',
    [`${PROSE}/ProseFace.swift`]: 'public struct ProseFace { public init() {} }\n',
    [`${MERMAID}/MermaidPlan.swift`]: 'public struct MermaidPlan { public init() {} }\n',
    [`${MERMAID_VIEW}/MermaidView.swift`]: 'import SwiftUI\n',
    [`${ATLAS}/AtlasPlan.swift`]: 'public struct AtlasPlan { public init() {} }\n',
    [`${ATLAS_VIEW}/AtlasView.swift`]: 'import SwiftUI\n',
    [ALLOW]: '# Nothing carried in the synthetic tree.\n',
    ...SCRIPTS,
    [`${SPECIMENS}/SpecimenRegistry.swift`]: 'import ArgoUI\n\nenum SpecimenRegistry {}\n',
    [`${FIXTURES}/TranscriptFixtures.swift`]: 'import ArgoEngine\n\nenum TranscriptFixtures {}\n',
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
  const script = path.join(root, 'scripts/swift-boundaries.sh')
  const result = spawnSync('/bin/sh', [script], { cwd: root, encoding: 'utf8' })
  rmSync(root, { recursive: true, force: true })
  return { status: result.status, output: `${result.stdout}${result.stderr}` }
}

// A declaration added just before a file's closing brace, which in both fixtures is the
// declaration's enclosing scope.
export const withFact = (source, declaration) => source.replace(/^}/m, `${declaration}\n}`)
export const projection = (contents) => ({ [`${SHELL}/CockpitPresentation+Hub.swift`]: contents })
export const projected = (contents) => ({
  [`${SHELL}/CockpitPresentation+Session.swift`]: contents,
})
export const values = (contents) => ({
  [`${SHELL}/CockpitPresentation+SessionValues.swift`]: contents,
})
