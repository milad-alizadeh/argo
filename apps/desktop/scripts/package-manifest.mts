// What is IN the packaged Argo.app, read back off the package and compared against a checked-in
// list. [Check the packaged desktop app against a checked-in
// manifest](https://github.com/milad-alizadeh/argo/issues/1806).
//
// The comparison is the exact set, not presence. Presence catches the file you forgot; the exact
// set also catches the file you did not mean to ship, which is the failure this repository has
// actually hit — #1743 found Forge's dependency walker hard to predict and #1791 turned pruning
// off entirely, so a sourcemap, a dev dependency or a signing artifact arrives with nobody
// editing a file. `forge.config.ts` holds the hand-maintained list of what enters the package and
// nothing read the result back.
//
// Three arrays, because the three places a file can arrive are checked by three different
// readings: the asar's own entry list, the unpacked tree on disk, and everything else under
// Contents/Resources.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { asarEntryList, resourcesDir } from './packaged-pty-checks.mts'

export const MANIFEST_PATH = path.resolve(import.meta.dirname, '..', 'package-manifest.json')

// The three arrays are named here rather than inline, so a manifest missing one fails as loudly
// as a manifest missing a file: an absent array would otherwise compare equal to an empty one.
export const SECTIONS = ['asar', 'unpacked', 'extraResources'] as const

/** One of the three places a file can arrive in the package. */
export type ManifestSection = (typeof SECTIONS)[number]

/** The three arrays, whether read off the package or off the checked-in file. */
export type PackageManifest = Record<ManifestSection, string[]>

const ASAR = 'app.asar'
const UNPACKED = 'app.asar.unpacked'

// Rollup names a content-addressed chunk `<name>-<hash><ext>` and its default hash is 8
// characters of [A-Za-z0-9_-]. Every one of those changes on every source edit, so comparing them
// literally would make the manifest a file nobody could keep current. The rule is code, never
// data in the manifest, so the checked-in file stays a plain sorted list a reviewer can read.
//
// It applies to `.vite` output alone. `node_modules`, the unpacked tree and the extra resources
// compare fully literally, because that is where an unwanted file actually arrives.
const VITE_OUTPUT = /^\/?\.vite\//
const CONTENT_HASH = /-[A-Za-z0-9_-]{8}(\.[^./]+)$/
const CLAUDE_AGENT_SDK_PLATFORM = /claude-agent-sdk-(?:darwin-arm64|linux-x64)(?=\/|$)/

export function normalisedEntry(entry: string): string {
  const platformNeutral = entry.replace(CLAUDE_AGENT_SDK_PLATFORM, 'claude-agent-sdk-[platform]')
  if (!VITE_OUTPUT.test(platformNeutral)) return platformNeutral
  return platformNeutral.replace(CONTENT_HASH, '-[hash]$1')
}

// Every file under `root`, as a path relative to it with forward slashes. Directories are not
// listed: an empty one ships nothing, and a directory that holds a file is named by that file.
function filesUnder(root: string, prefix = ''): string[] {
  const files: string[] = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) files.push(...filesUnder(path.join(root, entry.name), relative))
    else files.push(relative)
  }
  return files
}

function existingDirectory(target: string): boolean {
  try {
    return statSync(target).isDirectory()
  } catch {
    return false
  }
}

// Anything under Contents/Resources that is neither the asar nor the unpacked tree: Forge's
// `extraResource` copies land here, and so would a signing artifact left behind.
function extraResourceFiles(appPath: string): string[] {
  const resources = resourcesDir(appPath)
  const files: string[] = []
  for (const entry of readdirSync(resources, { withFileTypes: true })) {
    if (entry.name === ASAR || entry.name === UNPACKED) continue
    if (entry.isDirectory()) files.push(...filesUnder(path.join(resources, entry.name), entry.name))
    else files.push(entry.name)
  }
  return files
}

// The asar entry list keeps its directories: an asar carries a real directory record, so a new
// directory in it is a difference worth showing. The two filesystem readings list files alone.
export function readPackagedManifest(appPath: string): PackageManifest {
  const resources = resourcesDir(appPath)
  if (!existingDirectory(resources))
    throw new Error(`no Contents/Resources under ${appPath}, so nothing was read`)
  const unpacked = path.join(resources, UNPACKED)
  return {
    asar: asarEntryList(path.join(resources, ASAR)).map(normalisedEntry).sort(),
    unpacked: existingDirectory(unpacked) ? filesUnder(unpacked).sort() : [],
    extraResources: extraResourceFiles(appPath).sort(),
  }
}

// Parsed at the edge, once. A manifest that is not an object of three string arrays is a manifest
// nothing can compare against, and saying so beats comparing against `undefined`.
export function manifestSchemaFailures(manifest: unknown): string[] {
  if (typeof manifest !== 'object' || manifest === null || Array.isArray(manifest))
    return ['the manifest is not a JSON object']
  const sections = manifest as Record<string, unknown>
  const failures: string[] = []
  for (const section of SECTIONS) {
    const value = sections[section]
    if (!Array.isArray(value)) failures.push(`the manifest has no \`${section}\` array`)
    else if (value.some((entry) => typeof entry !== 'string'))
      failures.push(`\`${section}\` holds an entry that is not a string`)
  }
  for (const key of Object.keys(sections))
    if (!SECTIONS.includes(key as ManifestSection))
      failures.push(`\`${key}\` is not one of the three named arrays`)
  return failures
}

export function readCheckedInManifest(manifestPath = MANIFEST_PATH): {
  manifest: PackageManifest | null
  failures: string[]
} {
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch (error) {
    return {
      manifest: null,
      failures: [`${manifestPath} could not be read: ${(error as Error).message}`],
    }
  }
  const failures = manifestSchemaFailures(parsed)
  return {
    manifest:
      failures.length === 0
        ? (Object.fromEntries(
            SECTIONS.map((section) => [
              section,
              (parsed as PackageManifest)[section].map(normalisedEntry),
            ]),
          ) as PackageManifest)
        : null,
    failures,
  }
}

function sectionDifferences(section: string, expected: string[], actual: string[]): string[] {
  const expectedSet = new Set(expected)
  const actualSet = new Set(actual)
  return [
    ...actual.filter((entry) => !expectedSet.has(entry)).map((entry) => `${section} +${entry}`),
    ...expected.filter((entry) => !actualSet.has(entry)).map((entry) => `${section} -${entry}`),
  ]
}

// `+` is in the package and not in the manifest, `-` is the other way round. Both are failures:
// the exact set is the whole point, and a file that left the package silently is as much a
// regression as one that arrived.
export function manifestDifferences(expected: PackageManifest, actual: PackageManifest): string[] {
  return SECTIONS.flatMap((section) =>
    sectionDifferences(section, expected[section], actual[section]),
  )
}

// The one assertion the release verdict carries for the package contents (#1788). It is a value
// rather than an exit code, so the verdict holds what was compared and not merely that something
// passed; the callers turn it into an exit code themselves.
//
// Nothing here throws, including an app that was never packaged. A check that never ran must be
// as loud as one that ran and failed, and a stack trace with no assertion behind it is a silence.
/** The package-contents entry of the release verdict. */
export type PackageManifestAssertion = {
  name: string
  passed: boolean
  appPath: string
  differences: string[]
}

export function packageManifestAssertion(
  appPath: string,
  manifestPath = MANIFEST_PATH,
): PackageManifestAssertion {
  const refused = (differences: string[]): PackageManifestAssertion => ({
    name: 'packageManifest',
    passed: false,
    appPath,
    differences,
  })
  const { manifest, failures } = readCheckedInManifest(manifestPath)
  if (!manifest) return refused(failures)
  let packaged: PackageManifest
  try {
    packaged = readPackagedManifest(appPath)
  } catch (error) {
    return refused([(error as Error).message])
  }
  const differences = manifestDifferences(manifest, packaged)
  return { name: 'packageManifest', passed: differences.length === 0, appPath, differences }
}
