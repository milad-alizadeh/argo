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
import { asarEntryList, resourcesDir } from './packaged-pty-checks.mjs'

export const MANIFEST_PATH = path.resolve(import.meta.dirname, '..', 'package-manifest.json')

// The three arrays are named here rather than inline, so a manifest missing one fails as loudly
// as a manifest missing a file: an absent array would otherwise compare equal to an empty one.
export const SECTIONS = ['asar', 'unpacked', 'extraResources']

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

export function normalisedEntry(entry) {
  if (!VITE_OUTPUT.test(entry)) return entry
  return entry.replace(CONTENT_HASH, '-[hash]$1')
}

// Every file under `root`, as a path relative to it with forward slashes. Directories are not
// listed: an empty one ships nothing, and a directory that holds a file is named by that file.
function filesUnder(root, prefix = '') {
  const files = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) files.push(...filesUnder(path.join(root, entry.name), relative))
    else files.push(relative)
  }
  return files
}

function existingDirectory(target) {
  try {
    return statSync(target).isDirectory()
  } catch {
    return false
  }
}

// Anything under Contents/Resources that is neither the asar nor the unpacked tree: Forge's
// `extraResource` copies land here, and so would a signing artifact left behind.
function extraResourceFiles(appPath) {
  const resources = resourcesDir(appPath)
  const files = []
  for (const entry of readdirSync(resources, { withFileTypes: true })) {
    if (entry.name === ASAR || entry.name === UNPACKED) continue
    if (entry.isDirectory()) files.push(...filesUnder(path.join(resources, entry.name), entry.name))
    else files.push(entry.name)
  }
  return files
}

// The asar entry list keeps its directories: an asar carries a real directory record, so a new
// directory in it is a difference worth showing. The two filesystem readings list files alone.
export function readPackagedManifest(appPath) {
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
export function manifestSchemaFailures(manifest) {
  if (typeof manifest !== 'object' || manifest === null || Array.isArray(manifest))
    return ['the manifest is not a JSON object']
  const failures = []
  for (const section of SECTIONS) {
    const value = manifest[section]
    if (!Array.isArray(value)) failures.push(`the manifest has no \`${section}\` array`)
    else if (value.some((entry) => typeof entry !== 'string'))
      failures.push(`\`${section}\` holds an entry that is not a string`)
  }
  for (const key of Object.keys(manifest))
    if (!SECTIONS.includes(key)) failures.push(`\`${key}\` is not one of the three named arrays`)
  return failures
}

export function readCheckedInManifest(manifestPath = MANIFEST_PATH) {
  let parsed
  try {
    parsed = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch (error) {
    return { manifest: null, failures: [`${manifestPath} could not be read: ${error.message}`] }
  }
  const failures = manifestSchemaFailures(parsed)
  return { manifest: failures.length === 0 ? parsed : null, failures }
}

function sectionDifferences(section, expected, actual) {
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
export function manifestDifferences(expected, actual) {
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
export function packageManifestAssertion(appPath, manifestPath = MANIFEST_PATH) {
  const refused = (differences) => ({
    name: 'packageManifest',
    passed: false,
    appPath,
    differences,
  })
  const { manifest, failures } = readCheckedInManifest(manifestPath)
  if (!manifest) return refused(failures)
  let packaged
  try {
    packaged = readPackagedManifest(appPath)
  } catch (error) {
    return refused([error.message])
  }
  const differences = manifestDifferences(manifest, packaged)
  return { name: 'packageManifest', passed: differences.length === 0, appPath, differences }
}
