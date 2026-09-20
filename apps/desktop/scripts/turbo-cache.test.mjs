import { describe, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..')
const json = (file) => JSON.parse(readFileSync(file, 'utf8'))
const PACKAGED_PROOFS = [
  'test:packaged-contents',
  'test:packaged-manifest',
  'test:packaged-pty',
  'test:e2e',
  'test:e2e:adversarial',
]

// `turbo.json` carries no comments, because this file parses it with `JSON.parse` and turbo's own
// tolerance for them is not shared. So the reasoning behind each cache decision lives here, next
// to the assertion that holds it.
describe('what turbo caches', () => {
  const turbo = () => json(path.join(repoRoot, 'turbo.json'))
  const cached = (task) => turbo().tasks[task].cache !== false

  // The two persistent servers never finish, so they have nothing to cache.
  test('caches every task except the two servers', () => {
    expect(cached('dev')).toBe(false)
    expect(cached('storybook')).toBe(false)
    for (const task of [
      'build',
      ...PACKAGED_PROOFS,
      'typecheck',
      'test',
      'build:storybook',
      'test:storybook',
      'test:darwin-manifest',
    ])
      expect(cached(task), `${task} is cached`).toBe(true)
  })

  // A package's default input set stops at its own directory, so these assertions — which read
  // the ROOT manifest — are invisible to the hash of the task that runs them. Without the root
  // `package.json` in `globalDependencies`, renaming a root script would be judged by a cache
  // entry that never saw the rename, and `bun run test` would report a pass for the old names.
  // `.node-version` is here because CI installs the Node every task runs on from it, and
  // `turbo.json` because the assertions in this very block read it: turbo folds in only the
  // running task's own resolved definition, so an edit to `tasks.dev` is otherwise unhashed.
  test('hashes the files that decide a task without being read by it', () => {
    expect(turbo().globalDependencies).toContain('package.json')
    expect(turbo().globalDependencies).toContain('.node-version')
    expect(turbo().globalDependencies).toContain('turbo.json')
  })

  // The renderer imports values from `src/core`, `src/harnesses` and `src/components`, so a
  // hand-listed input set naming only some of `src` serves a stale site or a stale story verdict.
  test('hashes every source the Storybook site and its stories carry', () => {
    expect(turbo().tasks['build:storybook'].inputs[0]).toBe('$TURBO_DEFAULT$')
    expect(turbo().tasks['test:storybook'].inputs[0]).toBe('$TURBO_DEFAULT$')
  })

  // The default input set stops at the package directory, and these root files are read by the
  // design-token mirror test and imported by the typechecked scripts.
  test('hashes the root files the desktop tasks read', () => {
    expect(turbo().tasks.test.inputs).toContain('$TURBO_ROOT$/docs/design/tokens.css')
    expect(turbo().tasks.test.inputs).toContain('$TURBO_ROOT$/scripts/design-token-*.mjs')
    expect(turbo().tasks.typecheck.inputs).toContain('$TURBO_ROOT$/scripts/design-token-*.mjs')
  })

  // The Linux darwin package reads the signing and notarizing variables in `forge.config.ts`, and
  // strict env mode hides any variable a task does not name.
  test('hashes the variables that change the darwin package', () => {
    expect(turbo().tasks['test:darwin-manifest'].env).toEqual(['ARGO_SIGNING_*', 'ARGO_NOTARIZE_*'])
  })

  // `tsc --noEmit` and `bun test` write nothing, and a task with no declared outputs is a task
  // whose cache entry turbo cannot describe. The empty array is the statement, not an omission.
  test('says out loud that the verdict tasks emit nothing', () => {
    expect(turbo().tasks.typecheck.outputs).toEqual([])
    expect(turbo().tasks.test.outputs).toEqual([])
    expect(turbo().tasks['test:storybook'].outputs).toEqual([])
    expect(turbo().tasks['test:darwin-manifest'].outputs).toEqual([])
    for (const proof of PACKAGED_PROOFS) expect(turbo().tasks[proof].outputs).toEqual([])
  })

  // `build` is the packaged PTY test, so a `^build` edge puts a fifteen-minute package and a
  // 600-cycle app run in front of whatever declared it. Such an edge is inert only while nothing
  // depends on `@argo/desktop`; this refuses it instead of relying on that.
  test('keeps the packaged PTY test out of every other task graph', () => {
    for (const [name, task] of Object.entries(turbo().tasks))
      expect(task.dependsOn ?? [], `${name} depends on the release build`).not.toContain('^build')
  })

  // The suite reads its own fixtures, `forge.config.ts`, `package-manifest.json` and both
  // lockfiles. An input list that named them would go stale the first time a test read one more
  // file, and a stale list is a cache that serves a pass for code it never hashed. So `test`
  // narrows the default set rather than replacing it.
  test('narrows the test inputs without hand-listing them', () => {
    expect(turbo().tasks.test.inputs[0]).toBe('$TURBO_DEFAULT$')
  })
})

let dryRun
function resolved(task) {
  if (!dryRun) {
    const run = spawnSync(
      'bun',
      ['run', 'turbo', 'run', 'build', ...PACKAGED_PROOFS, '--filter=@argo/desktop', '--dry=json'],
      { cwd: repoRoot, encoding: 'utf8' },
    )
    if (run.status !== 0) throw new Error(`turbo's dry run exited ${run.status}:\n${run.stderr}`)
    dryRun = JSON.parse(run.stdout).tasks
  }
  const found = dryRun.find((candidate) => candidate.task === task)
  return { files: Object.keys(found.inputs), dependencies: found.dependencies }
}

// Read back from turbo itself, so a glob that matches more or less than the list says is caught.
// `build` is a fifteen-minute package, and a mock, a case or a journey in its hash rebuilds it on
// every test edit (#2324).
describe('what the packaged tasks hash', () => {
  test('hashes the application sources, native dependencies, Electron version and lockfiles into build', () => {
    const { files } = resolved('build')
    for (const file of [
      'src/main.ts',
      'src/preload.ts',
      'src/platform/renderer/tokens.css',
      'forge.config.ts',
      'package.json',
      'package-lock.json',
      '../../bun.lock',
    ])
      expect(files).toContain(file)
  }, 60_000)

  test('keeps the mocks, the e2e flows, the tools and the tests out of build', () => {
    const { files } = resolved('build')
    const leaked = files.filter(
      (file) =>
        /^(mocks|e2e|tools)\//.test(file) ||
        /\.(test|stories)\.[jt]sx?$/.test(file) ||
        file === 'tsconfig.e2e.json',
    )
    expect(leaked).toEqual([])
  }, 60_000)

  test.each([
    ['test:packaged-contents', 'scripts/packaged-mock-cli-checks.mjs'],
    ['test:packaged-manifest', 'package-manifest.json'],
    ['test:packaged-pty', 'scripts/prove-packaged-pty.mjs'],
    ['test:e2e', 'e2e/sessions/journeys.e2e.ts'],
    ['test:e2e', 'mocks/cli/claude/mock-claude.ts'],
    ['test:e2e:adversarial', 'e2e/sessions/adversarial.e2e.ts'],
  ])(
    'reruns %s after the packaged app or %s changes',
    (proof, file) => {
      const { files, dependencies } = resolved(proof)
      expect(dependencies).toEqual(['@argo/desktop#build'])
      expect(files).toContain(file)
    },
    60_000,
  )
})
