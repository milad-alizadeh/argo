import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  type Baseline,
  compareIdentities,
  executeCommand,
  type FailureIdentity,
  parseBunTestOutput,
  parseDependencyCruiserOutput,
  parseStorybookOutput,
  parseTypeScriptOutput,
  parseVitestOutput,
  removeResolvedEntries,
} from './migration-ratchet.mts'

const directory = path.dirname(fileURLToPath(import.meta.url))
const repository = path.resolve(directory, '..', '..')
const fixture = (name: string) => readFileSync(path.join(directory, 'fixtures', name), 'utf8')

test('TypeScript identity ignores locations, strips ANSI, and deduplicates output', () => {
  assert.deepEqual(parseTypeScriptOutput(fixture('typescript.txt'), '@argo/desktop', repository), [
    {
      workspace: '@argo/desktop',
      path: 'src/example.ts',
      code: 'TS2339',
      message: "Property 'missing' does not exist on type 'Example'.",
    },
    {
      workspace: '@argo/desktop',
      path: 'src/other.ts',
      code: 'TS7006',
      message: "Parameter 'value' implicitly has an 'any' type.",
    },
  ])
})

test('TypeScript identity changes with a diagnostic code or message', () => {
  const first = parseTypeScriptOutput(
    'src/example.ts(1,1): error TS1000: first message\n',
    'scripts',
    repository,
  )
  const second = parseTypeScriptOutput(
    'src/example.ts(99,4): error TS1001: second message\n',
    'scripts',
    repository,
  )
  assert.notDeepEqual(first, second)
})

test('TypeScript rejects a mixed recognized and unrecognized diagnostic result', () => {
  assert.throws(
    () =>
      parseTypeScriptOutput(
        'src/example.ts(1,1): error TS1000: recognized\nerror TS18003: pathless diagnostic\n',
        'scripts',
        repository,
      ),
    /1 diagnostic lines the parser did not recognize/,
  )
})

test('dependency identity uses structured errors and normalizes separators', () => {
  assert.deepEqual(parseDependencyCruiserOutput(fixture('boundaries.json')), [
    {
      rule: 'domain-port-only',
      source: 'apps/desktop/src/source.ts',
      target: 'apps/desktop/src/target.ts',
    },
  ])
})

test('Bun test identity keeps the file and complete test name', () => {
  assert.deepEqual(
    parseBunTestOutput(fixture('bun-tests.txt'), {
      project: '@argo/desktop',
      repositoryRoot: repository,
    }),
    [
      {
        project: '@argo/desktop',
        path: 'src/example.test.ts',
        test: 'outer behavior > reports the complete name',
      },
      {
        project: '@argo/desktop',
        path: 'src/setup.test.ts',
        test: '[suite setup]',
      },
    ],
  )
})

test('Bun test identity ignores GitHub Actions group markers', () => {
  assert.deepEqual(
    parseBunTestOutput(
      '@argo/desktop:test: ::group::src/example.test.ts:\n(fail) reports the failure\n 1 fail\n',
      {
        project: '@argo/desktop',
        repositoryRoot: repository,
      },
    ),
    [
      {
        project: '@argo/desktop',
        path: 'src/example.test.ts',
        test: 'reports the failure',
      },
    ],
  )
})

test('Bun requires a final summary and accepts a zero-failure summary', () => {
  const context = { project: '@argo/desktop', repositoryRoot: repository }
  assert.throws(() => parseBunTestOutput('', context), /no final failure summary/)
  assert.deepEqual(parseBunTestOutput(' 1 pass\n 0 fail\n', context), [])
  assert.throws(
    () => parseBunTestOutput('src/example.test.ts:\n(fail) broken\n', context),
    /no final failure summary/,
  )
})

test('Vitest identity reads its structured report', () => {
  assert.deepEqual(parseVitestOutput(fixture('vitest.json'), 'desktop-node', '/repo'), [
    {
      project: 'desktop-node',
      path: 'apps/desktop/src/example.vitest.ts',
      test: 'outer behavior > reports the complete name',
    },
  ])
})

test('Storybook identity includes path and complete story name', () => {
  assert.deepEqual(parseStorybookOutput(fixture('storybook.txt')), [
    {
      project: 'storybook',
      path: 'src/example.stories.tsx',
      story: 'First Story',
    },
    {
      project: 'storybook',
      path: 'src/example.stories.tsx',
      story: 'Nested Story > Keeps Its Full Name',
    },
    {
      project: 'storybook',
      path: 'src/other.stories.tsx',
      story: 'First Story',
    },
  ])
})

test('Storybook requires a final summary and accepts an all-pass summary', () => {
  assert.throws(() => parseStorybookOutput(''), /no final test summary/)
  assert.deepEqual(parseStorybookOutput(' Test Files  1 passed (1)\n Tests  3 passed (3)\n'), [])
})

const identity = (testName: string): FailureIdentity => ({
  project: 'example',
  path: 'src/example.test.ts',
  test: testName,
})

const baseline = (...identities: FailureIdentity[]): Baseline => ({
  version: 1,
  gate: 'tests',
  entries: identities.map((entryIdentity) => ({
    identity: entryIdentity,
    owner: '#2587',
    reason: 'Recorded migration debt.',
  })),
})

test('an observed set equal to the baseline has no differences', () => {
  assert.deepEqual(compareIdentities([identity('same')], baseline(identity('same'))), {
    added: [],
    resolved: [],
  })
})

test('a new failure and a resolved failure are both exact differences', () => {
  assert.deepEqual(compareIdentities([identity('new')], baseline(identity('old'))), {
    added: [identity('new')],
    resolved: [identity('old')],
  })
})

test('the resolution update removes entries and refuses additions', () => {
  assert.deepEqual(
    removeResolvedEntries(baseline(identity('keep'), identity('gone')), [identity('keep')]),
    {
      version: 1,
      gate: 'tests',
      entries: [
        {
          identity: identity('keep'),
          owner: '#2587',
          reason: 'Recorded migration debt.',
        },
      ],
    },
  )
  assert.throws(
    () => removeResolvedEntries(baseline(identity('old')), [identity('new')]),
    /refuses to add/,
  )
})

test('malformed structured output fails closed', () => {
  assert.throws(() => parseDependencyCruiserOutput('{"summary":{}}'), /violations/)
  assert.throws(() => parseVitestOutput('{"success":false}', 'node', repository), /testResults/)
  assert.throws(() => parseVitestOutput('{"testResults":[]}', 'node', repository), /numFailedTests/)
})

test('a missing tool fails closed', () => {
  const result = executeCommand({
    executable: 'argo-command-that-does-not-exist',
    args: [],
    cwd: repository,
    timeoutMilliseconds: 100,
  })
  assert.equal(result.kind, 'spawn-error')
})

test('a timed-out child process fails closed', () => {
  const result = executeCommand({
    executable: process.execPath,
    args: ['-e', 'setInterval(() => {}, 1_000)'],
    cwd: repository,
    timeoutMilliseconds: 10,
  })
  assert.equal(result.kind, 'timeout')
})

test('a child process killed by a signal fails closed', () => {
  const result = executeCommand({
    executable: process.execPath,
    args: ['-e', "process.kill(process.pid, 'SIGTERM')"],
    cwd: repository,
    timeoutMilliseconds: 100,
  })
  assert.equal(result.kind, 'signal')
  assert.equal(result.signal, 'SIGTERM')
})
