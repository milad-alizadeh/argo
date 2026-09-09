// What the shipped app's signature actually says — who signed it, whether the notarization ticket
// is stapled, and what entitlements every signed path inside it carries (#1771). The signing
// config states an intent; only this states the fact.
//
// The reason it is a gate rather than a note is the dependency range. `@electron-forge/core`
// depends on `@electron/packager` at `^18.3.5`, which depends on `@electron/osx-sign` at `^1.0.5`,
// so a new default entitlements plist arrives on an ordinary lockfile refresh with no upgrade step
// to review. `@electron/osx-sign` 1.3.3, the version installed here, defaults the main app to
// seven keys including the camera, the microphone and the user's location.
//
// It walks the whole bundle rather than replicating osx-sign's own walk. Reimplementing a
// dependency's file-classification heuristic would make this gate agree with the thing it is
// checking, and a path that heuristic stops yielding is exactly the regression it must catch.

import { execFileSync, spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import path from 'node:path'
import { entitlementKeysFor } from './entitlements.mjs'

// codesign says this about a path with no signature at all, which is most of the bundle. It is a
// skip, not a failure: an unsigned file carries no entitlements to widen.
const UNSIGNED = 'code object is not signed at all'

// A Developer ID signature says so in its authority chain. An ad-hoc signature — which
// `resetAdHocDarwinSignature` lays over every unsigned darwin package — verifies happily and has
// no authority at all, so exit code alone would call an unsigned build signed.
const DEVELOPER_ID = 'Authority=Developer ID Application:'

// codesign, spctl and stapler all report on stderr and say nothing on stdout, and a refusal is an
// answer here rather than an error, so both streams are read and the exit code is a value.
function readVerbose(command, args) {
  const spawned = spawnSync(command, args, { encoding: 'utf8' })
  return { ok: spawned.status === 0, output: `${spawned.stdout ?? ''}${spawned.stderr ?? ''}` }
}

// `signed` and `notarized` are explicit booleans in the verdict (ADR-0036 rule 5), and both are
// read off the artifact rather than off the environment that was supposed to produce them.
export function readSigningStatus(appPath) {
  const verified = readVerbose('codesign', [
    '--verify',
    '--deep',
    '--strict',
    '--verbose=2',
    appPath,
  ])
  const authority = readVerbose('codesign', ['--display', '--verbose=4', appPath])
  // The stapled ticket is what makes a first launch work with no network. Gatekeeper's own
  // assessment is recorded beside it, because a valid ticket and a refused assessment are
  // different failures.
  const stapled = readVerbose('xcrun', ['stapler', 'validate', appPath])
  const assessed = readVerbose('spctl', ['--assess', '--type', 'execute', '--verbose=4', appPath])
  return {
    signed: verified.ok && authority.output.includes(DEVELOPER_ID),
    notarized: stapled.ok,
    verified: verified.ok,
    gatekeeper: assessed.output.trim().split('\n').slice(0, 4).join(' · '),
    authority: authority.output
      .split('\n')
      .filter((line) => line.startsWith('Authority=') || line.startsWith('TeamIdentifier='))
      .map((line) => line.trim()),
  }
}

function walk(dirPath) {
  const found = []
  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    const child = path.join(dirPath, entry.name)
    if (entry.isSymbolicLink()) continue
    if (entry.isDirectory()) {
      found.push(...walk(child))
      // A bundle is signed as itself, and its signature is the one that seals the files inside it.
      if (child.endsWith('.app') || child.endsWith('.framework')) found.push(child)
    } else if (entry.isFile()) {
      found.push(child)
    }
  }
  return found
}

// Every path in the bundle that could carry a signature, plus the bundle itself, in the order
// `codesign` will be asked about them.
export function signablePaths(appPath) {
  return [...walk(path.join(appPath, 'Contents')), appPath]
}

// `codesign -d --entitlements - --xml` prints an entitlements plist on stdout and its own progress
// on stderr. An empty plist and an absent one both mean no entitlements.
function entitlementsXml(filePath) {
  try {
    return execFileSync('codesign', ['-d', '--entitlements', '-', '--xml', filePath], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (error) {
    const stderr = String(error.stderr ?? '')
    if (stderr.includes(UNSIGNED)) return null
    throw new Error(`codesign could not read ${filePath}: ${stderr.trim() || error.message}`)
  }
}

// The keys granted, which is not the same as the keys present: a key set to false grants nothing,
// and reporting it as an entitlement would fail a build over an entitlement it does not have.
export function grantedKeys(xml) {
  if (!xml.trim()) return []
  const json = execFileSync('plutil', ['-convert', 'json', '-o', '-', '-'], {
    encoding: 'utf8',
    input: xml,
  })
  const entitlements = JSON.parse(json)
  return Object.entries(entitlements)
    .filter(([, value]) => value === true)
    .map(([key]) => key)
    .sort()
}

function sameSet(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

// One reading per signed path: what it carries, what #1771 allows it, and whether they agree.
// Equality in both directions — a missing `allow-jit` on a process that runs V8 is as much a
// finding as an extra key, and it is the silent expensive one.
export function readEntitlements(appPath, appName) {
  const readings = []
  for (const filePath of signablePaths(appPath)) {
    const xml = entitlementsXml(filePath)
    if (xml === null) continue
    const granted = grantedKeys(xml)
    const allowed = [...entitlementKeysFor(filePath, appName)].sort()
    readings.push({
      path: path.relative(path.dirname(appPath), filePath),
      granted,
      allowed,
      matches: sameSet(granted, allowed),
    })
  }
  return readings
}

export function entitlementFailures(readings) {
  return readings
    .filter((reading) => !reading.matches)
    .map(
      (reading) =>
        `${reading.path} carries [${reading.granted.join(', ')}], and #1771 allows ` +
        `[${reading.allowed.join(', ')}].`,
    )
}
