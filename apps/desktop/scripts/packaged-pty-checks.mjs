// The four properties that decide whether `node-pty` can work inside a packaged Argo.app, read
// off the built artifact. [Assert node-pty works in the packaged, signed
// app](https://github.com/milad-alizadeh/argo/issues/1769).
//
// Every one of them fails QUIETLY. Forge's dependency walker finds no `node_modules` and ships an
// app with no PTY at exit code 0. A `spawn-helper` that lost its exec bit makes `pty.spawn`
// return a terminal that never runs a shell — no error, no output. A `.node` left inside the asar
// cannot be `dlopen`ed. And `OnlyLoadAppFromAsar` can be switched off to make an unpacking
// problem disappear (forge#3734), which trades the whole integrity guarantee for it.
//
// So nothing here trusts the step that was supposed to produce the property. It reads the asar
// header, stats the unpacked files, and reads the fuse wire back out of the shipped binary.

import { closeSync, openSync, readSync, statSync } from 'node:fs'
import path from 'node:path'
import asar from '@electron/asar'
import { FuseState, FuseV1Options, FuseVersion, getCurrentFuseWire } from '@electron/fuses'

const NODE_PTY = 'node_modules/node-pty'
const HELPER = 'spawn-helper'
const BINARY = 'pty.node'

// What `npm ci --omit=dev` is expected to leave behind, and therefore the whole of what may ship.
// `prune: false` hands the production install sole responsibility for keeping the package small,
// and nothing else notices if it stops doing that: dropping `--omit=dev` would carry electron,
// vite and the Forge toolchain into a signed app at exit code 0. #1791 chose node-pty on 400 KB
// against 62 MB, so the size IS the decision. Add a name here when a real dependency arrives.
const SHIPPABLE_MODULES = new Set(['node-pty', 'node-addon-api'])

// node-pty's own search order, from `lib/utils.js`. It requires the FIRST of these that holds
// `pty.node` and then derives `spawn-helper` from that same directory, rewriting `app.asar` to
// `app.asar.unpacked` in the path. So an incomplete `build/Release` — which `@electron/rebuild`
// can leave behind — shadows a perfectly good `prebuilds/`, and the helper is then looked for
// where it is not. Replicating the order is the only way to check the directory that will
// actually be chosen.
export function nativeDirs(arch) {
  return ['build/Release', 'build/Debug', `prebuilds/darwin-${arch}`]
}

// `Argo-darwin-arm64` → `arm64`. Forge names the output directory, so this is its contract — and
// only Forge's own `out/` obeys it. An app in /Applications has no architecture in its path, which
// is what `archOfBinary` is for.
export function archOf(outputPath) {
  const match = /-darwin-([^/]+)$/.exec(outputPath.replace(/\/$/, ''))
  return match?.[1] ?? null
}

// Mach-O `cputype`, the second 32-bit word of the header. This is the reading that works on an app
// the checker did not build — a downloaded release, or one already dragged to /Applications —
// where the directory name says nothing.
const MACH_O_MAGIC_64 = 0xfeedfacf
const CPU_TYPE = new Map([
  [0x0100000c, 'arm64'],
  [0x01000007, 'x64'],
])

export function archOfBinary(appPath) {
  const binary = executableIn(appPath)
  if (!statOrNull(binary)?.isFile()) return null
  const header = Buffer.alloc(8)
  const handle = openSync(binary, 'r')
  try {
    if (readSync(handle, header, 0, 8, 0) < 8) return null
  } finally {
    closeSync(handle)
  }
  // A universal binary leads with the big-endian fat magic and holds several architectures, so no
  // single answer is honest. #1745 ships arm64 alone, so that stays unsupported rather than guessed.
  if (header.readUInt32LE(0) !== MACH_O_MAGIC_64) return null
  return CPU_TYPE.get(header.readUInt32LE(4)) ?? null
}

export function resourcesDir(appPath) {
  return path.join(appPath, 'Contents', 'Resources')
}

function executableIn(appPath) {
  return path.join(appPath, 'Contents', 'MacOS', path.basename(appPath, '.app'))
}

function statOrNull(target) {
  try {
    return statSync(target)
  } catch {
    return null
  }
}

// The asar header lists unpacked entries too, so this answers "is node-pty in the package at
// all", which is the question Forge's silent walker failure makes necessary. `listPackage` leads
// every entry with a separator; stripping it is a fact about @electron/asar, and #1806 reads the
// same list to compare it against the checked-in manifest, so it is stated once here.
export function asarEntryList(asarPath) {
  return asar.listPackage(asarPath).map((entry) => entry.replace(/^[\\/]/, ''))
}

function asarEntries(asarPath) {
  return new Set(asarEntryList(asarPath))
}

function presenceFailures(asarPath, arch) {
  const entries = asarEntries(asarPath)
  if (!entries.has(`${NODE_PTY}/package.json`))
    return {
      failures: [
        `node-pty is not in ${asarPath}. Forge's dependency walker found no npm-shaped ` +
          `node_modules under apps/desktop and shipped the app anyway.`,
      ],
      chosen: null,
    }

  const chosen = nativeDirs(arch).find((dir) => entries.has(`${NODE_PTY}/${dir}/${BINARY}`))
  if (!chosen)
    return {
      failures: [
        `node-pty holds no ${BINARY} in any of ${nativeDirs(arch).join(', ')}, so its native ` +
          `module cannot load at all.`,
      ],
      chosen: null,
    }
  return { failures: [], chosen }
}

// `dlopen` needs a real file on disk, and so does the helper node-pty execs. Both live in the
// directory chosen above, and both have to survive the asar as ordinary files.
export function unpackedFailures(appPath, chosen) {
  const unpacked = path.join(resourcesDir(appPath), 'app.asar.unpacked', NODE_PTY, chosen)
  const failures = []
  for (const name of [BINARY, HELPER]) {
    const target = path.join(unpacked, name)
    const stats = statOrNull(target)
    if (!stats?.isFile()) {
      failures.push(`${chosen}/${name} is not an unpacked file at ${target}`)
      continue
    }
    if (stats.size === 0) failures.push(`${chosen}/${name} is unpacked but empty at ${target}`)
    // Owner, group and other alike: the packaged app runs as whoever installed it.
    else if (name === HELPER && (stats.mode & 0o111) !== 0o111)
      failures.push(
        `${chosen}/${HELPER} is mode ${(stats.mode & 0o777).toString(8)}, and needs the ` +
          `executable bit on owner, group and other. Every pty.spawn would fail silently.`,
      )
  }
  return failures
}

async function fuseFailures(appPath) {
  const binary = executableIn(appPath)
  if (!statOrNull(binary)) return [`no app executable at ${binary}`]
  const wire = await getCurrentFuseWire(binary, FuseVersion.V1)
  const actual = wire[FuseV1Options.OnlyLoadAppFromAsar]
  // FuseState is a numeric enum of ASCII code points, so comparing against '1' would pass on
  // every value the wire can hold.
  if (actual === FuseState.ENABLE) return []
  return [
    `fuse OnlyLoadAppFromAsar reads ${FuseState[actual] ?? actual}, expected ENABLE. Unpacking a ` +
      `path and disabling this fuse are different fixes, and only the first is one.`,
  ]
}

// The other half of "the production install IS the pruning": that it pruned. Read off the same
// asar listing, so it costs nothing.
//
// A package is its `package.json`, not its directory. `npm ci --omit=dev` removes the dev packages
// but leaves the empty `@scope` directories they lived in, and those reach the asar — so counting
// directories reports two dozen modules that ship no bytes.
export function extraModuleNames(entries) {
  const top = new Set()
  for (const entry of entries) {
    const parts = entry.split('/')
    if (parts[0] !== 'node_modules' || parts[parts.length - 1] !== 'package.json') continue
    if (parts.length === 3) top.add(parts[1])
    else if (parts.length === 4 && parts[1].startsWith('@')) top.add(`${parts[1]}/${parts[2]}`)
  }
  return [...top].filter((name) => !SHIPPABLE_MODULES.has(name)).sort()
}

function extraModuleFailures(asarPath) {
  const extra = extraModuleNames(asarEntries(asarPath))
  if (extra.length === 0) return []
  return [
    `${extra.length} module(s) beyond the production dependencies are in the package: ` +
      `${extra.slice(0, 10).join(', ')}. \`prune: false\` trusts the prePackage npm install to ` +
      `have run with --omit=dev, and this says it did not.`,
  ]
}

export async function packagedPtyFailures(appPath, arch) {
  if (!arch) return [`could not read an architecture out of ${appPath}`]
  const asarPath = path.join(resourcesDir(appPath), 'app.asar')
  if (!statOrNull(asarPath)?.isFile()) return [`no app.asar at ${asarPath}`]

  const { failures, chosen } = presenceFailures(asarPath, arch)
  const found = chosen ? unpackedFailures(appPath, chosen) : []
  return [...failures, ...found, ...extraModuleFailures(asarPath), ...(await fuseFailures(appPath))]
}
