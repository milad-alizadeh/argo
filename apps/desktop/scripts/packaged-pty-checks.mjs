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

import { statSync } from 'node:fs'
import path from 'node:path'
import asar from '@electron/asar'
import { FuseState, FuseV1Options, FuseVersion, getCurrentFuseWire } from '@electron/fuses'

const NODE_PTY = 'node_modules/node-pty'
const HELPER = 'spawn-helper'
const BINARY = 'pty.node'

// node-pty's own search order, from `lib/utils.js`. It requires the FIRST of these that holds
// `pty.node` and then derives `spawn-helper` from that same directory, rewriting `app.asar` to
// `app.asar.unpacked` in the path. So an incomplete `build/Release` — which `@electron/rebuild`
// can leave behind — shadows a perfectly good `prebuilds/`, and the helper is then looked for
// where it is not. Replicating the order is the only way to check the directory that will
// actually be chosen.
export function nativeDirs(arch) {
  return ['build/Release', 'build/Debug', `prebuilds/darwin-${arch}`]
}

// `Argo-darwin-arm64` → `arm64`. Forge names the output directory, so this is its contract.
export function archOf(outputPath) {
  const match = /-darwin-([^/]+)$/.exec(outputPath.replace(/\/$/, ''))
  return match?.[1] ?? null
}

export function resourcesDir(appPath) {
  return path.join(appPath, 'Contents', 'Resources')
}

export function executableIn(appPath) {
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
// all", which is the question Forge's silent walker failure makes necessary.
function asarEntries(asarPath) {
  return new Set(asar.listPackage(asarPath).map((entry) => entry.replace(/^[\\/]/, '')))
}

export function presenceFailures(asarPath, arch) {
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

export async function fuseFailures(appPath) {
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

export async function packagedPtyFailures(appPath, arch) {
  if (!arch) return [`could not read an architecture out of ${appPath}`]
  const asarPath = path.join(resourcesDir(appPath), 'app.asar')
  if (!statOrNull(asarPath)?.isFile()) return [`no app.asar at ${asarPath}`]

  const { failures, chosen } = presenceFailures(asarPath, arch)
  const found = chosen ? unpackedFailures(appPath, chosen) : []
  return [...failures, ...found, ...(await fuseFailures(appPath))]
}
