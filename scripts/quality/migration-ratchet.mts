import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripVTControlCharacters } from 'node:util'

import {
  desktopRoot,
  type GateCommand,
  type GateName,
  gateCommands,
  repositoryRoot,
} from './migration-ratchet-commands.mts'

export type TypeScriptIdentity = {
  workspace: string
  path: string
  code: string
  message: string
}

export type BoundaryIdentity = {
  rule: string
  source: string
  target: string
}

export type TestIdentity = {
  project: string
  path: string
  test: string
}

export type StorybookIdentity = {
  project: string
  path: string
  story: string
}

export type FailureIdentity =
  | TypeScriptIdentity
  | BoundaryIdentity
  | TestIdentity
  | StorybookIdentity

export type BaselineEntry = {
  identity: FailureIdentity
  owner: `#${number}`
  reason: string
}

export type Baseline = {
  version: 1
  gate: string
  entries: BaselineEntry[]
}

export type Command = {
  executable: string
  args: string[]
  cwd: string
  timeoutMilliseconds: number
}

export type CommandResult = {
  kind: 'completed' | 'signal' | 'spawn-error' | 'timeout'
  status: number | null
  signal: NodeJS.Signals | null
  stdout: string
  stderr: string
  error?: string
}

const TURBO_PREFIX = /^[^:\n]+:(?:typecheck|test|test:storybook): ?/

const stripAnsi = (value: string) => stripVTControlCharacters(value)
const normalizeWhitespace = (value: string) => value.trim().replace(/\s+/g, ' ')
const identityKey = (identity: FailureIdentity) => JSON.stringify(identity)

const normalizePath = (value: string, repositoryRoot?: string) => {
  const normalized = value.replaceAll('\\', '/').replace(/^\.\//, '')
  if (!repositoryRoot) return normalized
  const normalizedRoot = repositoryRoot.replaceAll('\\', '/').replace(/\/$/, '')
  return normalized.startsWith(`${normalizedRoot}/`)
    ? normalized.slice(normalizedRoot.length + 1)
    : normalized
}

const uniqueSorted = <Identity extends FailureIdentity>(identities: Identity[]): Identity[] =>
  [...new Map(identities.map((identity) => [identityKey(identity), identity])).values()].sort(
    (left, right) => identityKey(left).localeCompare(identityKey(right)),
  )

export function parseTypeScriptOutput(
  rawOutput: string,
  workspace: string,
  repositoryRoot: string,
): TypeScriptIdentity[] {
  const identities: TypeScriptIdentity[] = []
  let current: TypeScriptIdentity | undefined
  let diagnosticLineCount = 0
  let recognizedDiagnosticCount = 0

  for (const rawLine of stripAnsi(rawOutput).split(/\r?\n/)) {
    const line = rawLine.replace(TURBO_PREFIX, '')
    if (/error TS\d+:/.test(line)) diagnosticLineCount += 1
    const diagnostic = line.match(/^(.+?)\(\d+,\d+\): error (TS\d+): (.+)$/)
    if (diagnostic) {
      const [, diagnosticPath, code, message] = diagnostic
      if (!(diagnosticPath && code && message)) continue
      recognizedDiagnosticCount += 1
      current = {
        workspace,
        path: normalizePath(diagnosticPath, repositoryRoot),
        code,
        message: normalizeWhitespace(message),
      }
      identities.push(current)
      continue
    }

    if (
      current &&
      /^\s+\S/.test(line) &&
      !/^\s*(Tasks:|Cached:|Time:|Failed:|ERROR|\$)/.test(line)
    ) {
      current.message = normalizeWhitespace(`${current.message} ${line}`)
    } else if (line.trim()) {
      current = undefined
    }
  }
  const parsed = uniqueSorted(identities)
  if (diagnosticLineCount !== recognizedDiagnosticCount) {
    throw new Error(
      `TypeScript output contains ${diagnosticLineCount - recognizedDiagnosticCount} diagnostic lines the parser did not recognize`,
    )
  }
  return parsed
}

type DependencyCruiserReport = {
  summary?: {
    violations?: Array<{
      from?: unknown
      to?: unknown
      rule?: { name?: unknown; severity?: unknown }
    }>
  }
}

export function parseDependencyCruiserOutput(rawOutput: string): BoundaryIdentity[] {
  let report: DependencyCruiserReport
  try {
    report = JSON.parse(stripAnsi(rawOutput)) as DependencyCruiserReport
  } catch (error) {
    throw new Error(`dependency-cruiser returned malformed JSON: ${String(error)}`)
  }

  const violations = report.summary?.violations
  if (!Array.isArray(violations)) {
    throw new Error('dependency-cruiser JSON has no summary.violations array')
  }

  const identities = violations.flatMap((violation) => {
    if (violation.rule?.severity !== 'error') return []
    if (
      typeof violation.rule.name !== 'string' ||
      typeof violation.from !== 'string' ||
      typeof violation.to !== 'string'
    ) {
      throw new Error('dependency-cruiser returned an unrecognized error violation')
    }
    return [
      {
        rule: violation.rule.name,
        source: normalizePath(violation.from),
        target: normalizePath(violation.to),
      },
    ]
  })
  return uniqueSorted(identities)
}

type TestParserContext = {
  project: string
  repositoryRoot: string
  workingDirectory?: string
}

function bunFailureForLine(
  line: string,
  currentPath: string,
  project: string,
): TestIdentity | undefined {
  const failedTest = line.match(/^\(fail\) (.+?)(?: \[\d+(?:\.\d+)?ms\])?$/)?.[1]
  if (failedTest) {
    return { project, path: currentPath, test: normalizeWhitespace(failedTest) }
  }
  return line.trim() === '# Unhandled error between tests'
    ? { project, path: currentPath, test: '[suite setup]' }
    : undefined
}

export function parseBunTestOutput(rawOutput: string, context: TestParserContext): TestIdentity[] {
  const identities: TestIdentity[] = []
  let currentPath: string | undefined
  const workingDirectory = context.workingDirectory ?? context.repositoryRoot

  for (const rawLine of stripAnsi(rawOutput).split(/\r?\n/)) {
    const line = rawLine.replace(TURBO_PREFIX, '').replace(/^::group::/, '')
    if (/^\d+ tests? failed:$/.test(line.trim())) break
    const file = line.match(/^(.+\.(?:test\.(?:ts|tsx|mts)|vitest\.ts)):$/)
    if (file?.[1]) {
      const filePath = path.isAbsolute(file[1]) ? file[1] : path.join(workingDirectory, file[1])
      currentPath = normalizePath(filePath, context.repositoryRoot)
      continue
    }
    if (!currentPath) continue
    const failure = bunFailureForLine(line, currentPath, context.project)
    if (failure) identities.push(failure)
  }

  const parsed = uniqueSorted(identities)
  const reportedFailureCount = [...stripAnsi(rawOutput).matchAll(/^\s*(\d+) fail$/gm)].at(-1)?.[1]
  if (reportedFailureCount === undefined) {
    throw new Error('Bun output has no final failure summary')
  }
  if (Number(reportedFailureCount) !== parsed.length) {
    throw new Error(
      `Bun reported ${reportedFailureCount} failures but the parser recognized ${parsed.length}`,
    )
  }
  return parsed
}

type VitestReport = {
  numFailedTests?: unknown
  testResults?: Array<{
    name?: unknown
    status?: unknown
    assertionResults?: Array<{
      ancestorTitles?: unknown
      title?: unknown
      status?: unknown
    }>
  }>
}

function parseVitestResult(
  result: NonNullable<VitestReport['testResults']>[number],
  project: string,
  repositoryRoot: string,
) {
  if (typeof result.name !== 'string' || !Array.isArray(result.assertionResults)) {
    throw new Error('Vitest returned an unrecognized test result')
  }
  const identities: TestIdentity[] = []
  for (const assertion of result.assertionResults) {
    if (assertion.status !== 'failed') continue
    if (
      typeof assertion.title !== 'string' ||
      !Array.isArray(assertion.ancestorTitles) ||
      !assertion.ancestorTitles.every((title) => typeof title === 'string')
    ) {
      throw new Error('Vitest returned an unrecognized failed assertion')
    }
    identities.push({
      project,
      path: normalizePath(result.name, repositoryRoot),
      test: [...assertion.ancestorTitles, assertion.title].join(' > '),
    })
  }
  if (result.status === 'failed' && identities.length === 0) {
    identities.push({
      project,
      path: normalizePath(result.name, repositoryRoot),
      test: '[suite setup]',
    })
  }
  return identities
}

export function parseVitestOutput(
  rawOutput: string,
  project: string,
  repositoryRoot: string,
): TestIdentity[] {
  let report: VitestReport
  try {
    report = JSON.parse(stripAnsi(rawOutput)) as VitestReport
  } catch (error) {
    throw new Error(`Vitest returned malformed JSON: ${String(error)}`)
  }
  if (!Array.isArray(report.testResults)) throw new Error('Vitest JSON has no testResults array')
  if (
    typeof report.numFailedTests !== 'number' ||
    !Number.isInteger(report.numFailedTests) ||
    report.numFailedTests < 0
  ) {
    throw new Error('Vitest JSON has no valid numFailedTests count')
  }

  const identities: TestIdentity[] = []
  for (const result of report.testResults) {
    identities.push(...parseVitestResult(result, project, repositoryRoot))
  }
  const parsed = uniqueSorted(identities)
  if (report.numFailedTests !== parsed.length) {
    throw new Error(
      `Vitest reported ${report.numFailedTests} failures but the parser recognized ${parsed.length}`,
    )
  }
  return parsed
}

function validateStorybookSummary(output: string, parsedFailureCount: number) {
  const reportedFailureCount = [...output.matchAll(/^\s*Tests\s+(\d+) failed/gm)].at(-1)?.[1]
  const hasPassingSummary = /^\s*Tests\s+\d+ passed(?:\s|$)/m.test(output)
  if (reportedFailureCount === undefined && !hasPassingSummary) {
    throw new Error('Storybook output has no final test summary')
  }
  if (reportedFailureCount !== undefined && Number(reportedFailureCount) !== parsedFailureCount) {
    throw new Error(
      `Storybook reported ${reportedFailureCount} failures but the parser recognized ${parsedFailureCount}`,
    )
  }
  if (reportedFailureCount === undefined && /(?:^\s*× |^\s*FAIL )/m.test(output)) {
    throw new Error('Storybook output contains failures but no recognized failure summary')
  }
}

export function parseStorybookOutput(rawOutput: string, pathPrefix = ''): StorybookIdentity[] {
  const identities: StorybookIdentity[] = []
  let current: Pick<StorybookIdentity, 'project' | 'path'> | undefined

  for (const rawLine of stripAnsi(rawOutput).split(/\r?\n/)) {
    const line = rawLine.replace(TURBO_PREFIX, '')
    const file = line.match(/[❯>]\s+\|(storybook-(?:dark|light)) \([^)]*\)\| (.+?) \(/)
    if (file?.[1] && file[2]) {
      current = {
        project: file[1],
        path: normalizePath(pathPrefix ? path.join(pathPrefix, file[2]) : file[2]),
      }
      continue
    }
    const failedStory = line.match(/^\s*× (.+?)(?: \d+(?:\.\d+)?ms)?$/)
    if (current && failedStory?.[1]) {
      identities.push({ ...current, story: normalizeWhitespace(failedStory[1]) })
    }
  }
  const parsed = uniqueSorted(identities)
  const output = stripAnsi(rawOutput)
  validateStorybookSummary(output, parsed.length)
  return parsed
}

export function compareIdentities(observed: FailureIdentity[], baseline: Baseline) {
  const observedByKey = new Map(
    uniqueSorted(observed).map((identity) => [identityKey(identity), identity]),
  )
  const baselineByKey = new Map(
    baseline.entries.map((entry) => [identityKey(entry.identity), entry.identity]),
  )
  return {
    added: [...observedByKey]
      .filter(([key]) => !baselineByKey.has(key))
      .map(([, identity]) => identity),
    resolved: [...baselineByKey]
      .filter(([key]) => !observedByKey.has(key))
      .map(([, identity]) => identity),
  }
}

export function removeResolvedEntries(baseline: Baseline, observed: FailureIdentity[]): Baseline {
  const differences = compareIdentities(observed, baseline)
  if (differences.added.length > 0) {
    throw new Error('The resolution command refuses to add a new baseline entry.')
  }
  const observedKeys = new Set(observed.map(identityKey))
  return {
    ...baseline,
    entries: baseline.entries.filter((entry) => observedKeys.has(identityKey(entry.identity))),
  }
}

export function executeCommand(command: Command): CommandResult {
  const result = spawnSync(command.executable, command.args, {
    cwd: command.cwd,
    encoding: 'utf8',
    timeout: command.timeoutMilliseconds,
    maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
  })
  const stdout = result.stdout ?? ''
  const stderr = result.stderr ?? ''
  if (result.error) {
    const error = result.error as NodeJS.ErrnoException
    return {
      kind: error.code === 'ETIMEDOUT' ? 'timeout' : 'spawn-error',
      status: result.status,
      signal: result.signal,
      stdout,
      stderr,
      error: error.message,
    }
  }
  if (result.signal) {
    return {
      kind: 'signal',
      status: result.status,
      signal: result.signal,
      stdout,
      stderr,
      error: `terminated by ${result.signal}`,
    }
  }
  return {
    kind: 'completed',
    status: result.status,
    signal: result.signal,
    stdout,
    stderr,
  }
}

const scriptPath = fileURLToPath(import.meta.url)

type GateRun = {
  observed: FailureIdentity[]
  rawFailed: boolean
  infrastructureFailures: string[]
  log: string
}

function parseCommandOutput(command: GateCommand, result: CommandResult): FailureIdentity[] {
  const parser = command.parser
  if (!parser) return []
  const output = `${result.stdout}\n${result.stderr}`
  switch (parser.kind) {
    case 'typescript':
      return parseTypeScriptOutput(output, parser.workspace, repositoryRoot)
    case 'boundaries':
      return parseDependencyCruiserOutput(result.stdout)
    case 'bun-tests':
      return parseBunTestOutput(output, {
        project: parser.project,
        repositoryRoot,
        workingDirectory: desktopRoot,
      })
    case 'vitest':
      return parseVitestOutput(result.stdout, parser.project, repositoryRoot)
    case 'storybook':
      return parseStorybookOutput(output, 'apps/desktop')
  }
}

function runGateCommand(command: GateCommand) {
  const result = executeCommand(command)
  const log = `## ${command.label}\n\n${result.stdout}${result.stderr}`
  if (result.kind !== 'completed') {
    return {
      identities: [] as FailureIdentity[],
      rawFailed: true,
      infrastructureFailure: `${command.label}: ${result.error ?? result.kind}`,
      log,
    }
  }

  let identities: FailureIdentity[] = []
  try {
    identities = parseCommandOutput(command, result)
  } catch (error) {
    return {
      identities,
      rawFailed: true,
      infrastructureFailure: `${command.label}: ${String(error)}`,
      log,
    }
  }

  const commandFailed = result.status !== 0
  const structuredFailure = Boolean(command.failuresExitZero && identities.length > 0)
  return {
    identities,
    rawFailed: commandFailed || structuredFailure,
    infrastructureFailure:
      commandFailed && identities.length === 0
        ? `${command.label}: exited ${result.status ?? 'without a status'} without a recognized failure`
        : undefined,
    log,
  }
}

function runGate(gate: GateName): GateRun {
  const observed: FailureIdentity[] = []
  const infrastructureFailures: string[] = []
  const logs: string[] = []
  let rawFailed = false

  for (const command of gateCommands[gate]) {
    const commandRun = runGateCommand(command)
    observed.push(...commandRun.identities)
    rawFailed ||= commandRun.rawFailed
    logs.push(commandRun.log)
    if (commandRun.infrastructureFailure) {
      infrastructureFailures.push(commandRun.infrastructureFailure)
    }
  }

  return {
    observed: uniqueSorted(observed),
    rawFailed,
    infrastructureFailures,
    log: logs.join('\n\n'),
  }
}

function baselinePath(gate: GateName) {
  return path.join(repositoryRoot, 'scripts', 'quality', 'baselines', `${gate}.json`)
}

function readBaseline(gate: GateName): Baseline {
  const value = JSON.parse(readFileSync(baselinePath(gate), 'utf8')) as Partial<Baseline>
  if (value.version !== 1 || value.gate !== gate || !Array.isArray(value.entries)) {
    throw new Error(`${gate} baseline does not match schema version 1`)
  }
  for (const entry of value.entries) {
    if (
      !entry ||
      typeof entry.owner !== 'string' ||
      !/^#\d+$/.test(entry.owner) ||
      typeof entry.reason !== 'string' ||
      !entry.reason.trim() ||
      !entry.identity ||
      typeof entry.identity !== 'object'
    ) {
      throw new Error(`${gate} baseline contains an invalid entry`)
    }
  }
  return value as Baseline
}

const printIdentity = (identity: FailureIdentity) => `  ${identityKey(identity)}`

function writeRawLog(gate: GateName, log: string) {
  const directory = path.join(os.tmpdir(), 'argo-migration-ratchet')
  mkdirSync(directory, { recursive: true })
  const logPath = path.join(directory, `${gate}-${Date.now()}.log`)
  writeFileSync(logPath, log)
  return logPath
}

function checkGate(gate: GateName) {
  const run = runGate(gate)
  if (run.infrastructureFailures.length > 0) {
    console.error(`migration ratchet could not judge ${gate}:`)
    for (const failure of run.infrastructureFailures) console.error(`  ${failure}`)
    console.error(`raw log: ${writeRawLog(gate, run.log)}`)
    return 1
  }

  const baseline = readBaseline(gate)
  const differences = compareIdentities(run.observed, baseline)
  if (differences.added.length > 0) {
    console.error(`new ${gate} failures:`)
    for (const identity of differences.added) console.error(printIdentity(identity))
  }
  if (differences.resolved.length > 0) {
    console.error(`resolved ${gate} baseline entries; run the remove-resolved command:`)
    for (const identity of differences.resolved) console.error(printIdentity(identity))
  }
  if (differences.added.length > 0 || differences.resolved.length > 0) {
    console.error(`raw log: ${writeRawLog(gate, run.log)}`)
    return 1
  }
  console.log(`migration ratchet: ${gate} matches ${baseline.entries.length} recorded failures`)
  return 0
}

function printRaw(gate: GateName) {
  const run = runGate(gate)
  process.stdout.write(run.log)
  if (run.infrastructureFailures.length > 0) {
    process.stderr.write(`\n${run.infrastructureFailures.join('\n')}\n`)
    return 1
  }
  return run.rawFailed ? 1 : 0
}

function removeResolved(gate: GateName) {
  const run = runGate(gate)
  if (run.infrastructureFailures.length > 0) {
    for (const failure of run.infrastructureFailures) console.error(failure)
    return 1
  }
  const baseline = readBaseline(gate)
  let updated: Baseline
  try {
    updated = removeResolvedEntries(baseline, run.observed)
  } catch (error) {
    console.error(String(error))
    return 1
  }
  const removed = compareIdentities(run.observed, baseline).resolved
  if (removed.length === 0) {
    console.log(`${gate} baseline has no resolved entries`)
    return 0
  }
  console.log(`removing ${removed.length} resolved ${gate} baseline entries:`)
  for (const identity of removed) console.log(printIdentity(identity))
  writeFileSync(baselinePath(gate), `${JSON.stringify(updated, null, 2)}\n`)
  return 0
}

function parseGate(value: string | undefined): GateName {
  if (value === 'types' || value === 'boundaries' || value === 'tests' || value === 'storybook') {
    return value
  }
  throw new Error('gate must be one of: types, boundaries, tests, storybook')
}

function main() {
  const mode = process.argv[2]
  const gate = parseGate(process.argv[3])
  if (mode === 'check') return checkGate(gate)
  if (mode === 'raw') return printRaw(gate)
  if (mode === 'remove-resolved') return removeResolved(gate)
  throw new Error('usage: migration-ratchet.mts <check|raw|remove-resolved> <gate>')
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  try {
    process.exitCode = main()
  } catch (error) {
    console.error(String(error))
    process.exitCode = 1
  }
}
