// The production fuse profile, and the one place it is written down (#1757). `forge.config.ts`
// burns it into the binary; `readFuseWire` reads it back out of the shipped one for the verdict.
//
// All nine are named. Three of them keep Electron's default value and are named anyway, so that a
// default which moves in an upgrade is a failing read-back rather than a silent change.

import { FuseState, FuseV1Options, FuseVersion, getCurrentFuseWire } from '@electron/fuses'

export const PRODUCTION_FUSE_PROFILE = {
  // Ignores ELECTRON_RUN_AS_NODE. No Session host uses `child_process.fork`.
  [FuseV1Options.RunAsNode]: false,
  // Default. The transition is one-way and depends on a stable signature, so it waits for the
  // credential-storage design rather than being turned on by a build.
  [FuseV1Options.EnableCookieEncryption]: false,
  // Ignores NODE_OPTIONS and NODE_EXTRA_CA_CERTS.
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
  // Off in production, and the only fuse the test profile flips: on, Playwright can attach.
  [FuseV1Options.EnableNodeCliInspectArguments]: false,
  // Validates the app.asar header hash at launch and force-terminates on a mismatch.
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
  // Without it Electron searches app.asar, then app, then default_app.asar, and the docs say
  // integrity checking "can be bypassed via the Electron app code search path".
  [FuseV1Options.OnlyLoadAppFromAsar]: true,
  // Default. It isolates the main process from a snapshot built for nodeIntegration renderers,
  // which Argo does not have, and costs main-process startup.
  [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false,
  // Default. Keeps `fetch` over `file://` working while the renderer is loaded with `loadFile`.
  [FuseV1Options.GrantFileProtocolExtraPrivileges]: true,
  // Default. V8 traps out-of-bounds WebAssembly access with signal-handler guard pages.
  [FuseV1Options.WasmTrapHandlers]: true,
}

const FUSE_NAMES = Object.fromEntries(
  Object.values(FuseV1Options)
    .filter((value) => typeof value === 'number')
    .map((value) => [value, FuseV1Options[value]]),
)

// FuseState is a numeric enum of ASCII code points, so a wire value is compared against
// FuseState.ENABLE and never against the character '1'.
function isEnabled(state) {
  return state === FuseState.ENABLE
}

// Returns one entry per fuse in the profile: what the binary reads, what the profile requires, and
// whether they agree. The verdict carries the whole list rather than a pass flag, because "the
// check never ran" and "every fuse is right" have to look different in the document.
export async function readFuseWire(binaryPath) {
  const wire = await getCurrentFuseWire(binaryPath, FuseVersion.V1)
  return Object.entries(PRODUCTION_FUSE_PROFILE).map(([index, expected]) => {
    const state = wire[index]
    const actual = isEnabled(state)
    return {
      fuse: FUSE_NAMES[index],
      expected,
      actual,
      // A fuse that is neither ENABLE nor DISABLE was left to inherit or removed from the wire,
      // which reads as a mismatch here and is worth naming in the document.
      state: FuseState[state] ?? String(state),
      matches: actual === expected,
    }
  })
}

export function fuseWireFailures(readings) {
  return readings
    .filter((reading) => !reading.matches)
    .map(
      (reading) =>
        `fuse ${reading.fuse} reads ${reading.state}, expected ${reading.expected ? 'ENABLE' : 'DISABLE'}.`,
    )
}
