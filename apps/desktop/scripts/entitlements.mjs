// The entitlement set the signed app carries, and the one place it is written down (#1771).
// `forge.config.ts` asks this which plist to hand `codesign` for a path; `entitlements-readback.mjs`
// asks it which keys that path must carry afterwards. A config states an intent and only the
// artifact states the fact, so both readings come from here.
//
// @electron/osx-sign calls `optionsForFile` for every path its walk yields — every file
// `isbinaryfile` calls binary, plus every `.app` and `.framework` directory, plus the app bundle
// itself. `mergeOptionsForFile` overrides its own default only when `entitlements !== undefined`,
// so a path this function fails to answer for takes the wide default plist. That is why the last
// return is unconditional rather than the tail of a chain of conditions.

export const ALLOW_JIT = 'com.apple.security.cs.allow-jit'

// Relative to `apps/desktop`, which is the working directory Forge runs from — the same shape as
// `icon` in the packager config.
export const ENTITLEMENTS_PLISTS = {
  'allow-jit': 'assets/entitlements/allow-jit.plist',
  none: 'assets/entitlements/none.plist',
}

const PROFILE_KEYS = {
  'allow-jit': [ALLOW_JIT],
  none: [],
}

// Chromium's plugin helper is reachable only through `allowLoadingUnsignedLibraries`, which Argo
// does not set, so it runs no V8 of Argo's. It is matched first because its bundle name also
// contains the plain helper's name.
function isPluginHelper(filePath, appName) {
  return filePath.includes(`${appName} Helper (Plugin).app`)
}

// The GPU and renderer helpers run V8, and so does the plain helper: Electron forks a
// `utilityProcess` into it by default. The plain-helper row is the one assumption in #1771's set,
// and the first packaged acceptance run settles whether Argo ever forks one.
function runsV8Helper(filePath, appName) {
  return (
    filePath.includes(`${appName} Helper (GPU).app`) ||
    filePath.includes(`${appName} Helper (Renderer).app`) ||
    filePath.includes(`${appName} Helper.app`)
  )
}

// The app bundle and its main executable. The walk hands over both, and both are signed.
function isMainApp(filePath, appName) {
  return (
    filePath.endsWith(`/${appName}.app`) ||
    filePath.endsWith(`/${appName}.app/Contents/MacOS/${appName}`)
  )
}

export function entitlementsProfileFor(filePath, appName) {
  if (isPluginHelper(filePath, appName)) return 'none'
  if (runsV8Helper(filePath, appName)) return 'allow-jit'
  if (isMainApp(filePath, appName)) return 'allow-jit'
  return 'none'
}

export function entitlementsPlistFor(filePath, appName) {
  return ENTITLEMENTS_PLISTS[entitlementsProfileFor(filePath, appName)]
}

export function entitlementKeysFor(filePath, appName) {
  return PROFILE_KEYS[entitlementsProfileFor(filePath, appName)]
}
