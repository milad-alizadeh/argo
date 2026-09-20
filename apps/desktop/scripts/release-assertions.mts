// The individual assertions a release verdict is made of (ADR-0036,
// [#1807](https://github.com/milad-alizadeh/argo/issues/1807)). `release-verdict.mts` assembles
// them into the one document; each one lives here so that adding a check is a function beside its
// neighbours rather than another report sitting where the publish gate cannot see it.
//
// Nothing in here throws on a missing input. A check that could not run has to be as loud as one
// that ran and failed, and a stack trace with no assertion behind it is a silence.
import { readFileSync } from 'node:fs'
import { type FuseReading, fuseWireFailures, readFuseWire } from './fuse-profile.mts'
import {
  type EntitlementReading,
  entitlementFailures,
  readEntitlements,
  type SigningStatus,
} from './signing-readback.mts'

/** What every assertion in the verdict has in common. */
export type Assertion = {
  name: string
  passed: boolean
  failures?: string[]
  reason?: string
}

// `update.electronjs.org` matches its macOS ZIP with this, in `src/updates.ts`. Squirrel.Mac
// installs ZIP updates only, so the DMG is the human download and this asset is the whole update
// channel. A renamed asset is the one failure in the set that is completely silent: everything
// signs, everything verifies, the release publishes, and no user ever receives an update.
export const UPDATER_ZIP_PATTERN = /.*-(mac|darwin|osx).*\.zip$/i

export function updaterAssetAssertion(assetNames: string[]): Assertion & {
  asset: string | null
  matches: string[]
} {
  const matches = assetNames.filter((name) => UPDATER_ZIP_PATTERN.test(name)).sort()
  if (matches.length === 1)
    return { name: 'updaterAsset', passed: true, asset: matches[0] ?? null, matches }
  const reason =
    matches.length === 0
      ? `no asset matches ${UPDATER_ZIP_PATTERN}, so update.electronjs.org offers this release to nobody.`
      : // The feed takes the first matching asset in GitHub's list order, which no rule here fixes,
        // so two matches leave which bytes a user receives unspecified.
        `${matches.length} assets match ${UPDATER_ZIP_PATTERN} (${matches.join(', ')}), and the feed takes whichever GitHub lists first.`
  return { name: 'updaterAsset', passed: false, asset: null, matches, reason }
}

export async function fuseAssertion(
  binaryPath: string,
): Promise<Assertion & { readings: FuseReading[]; failures: string[] }> {
  try {
    const readings = await readFuseWire(binaryPath)
    const failures = fuseWireFailures(readings)
    return { name: 'fuses', passed: failures.length === 0, readings, failures }
  } catch (error) {
    return {
      name: 'fuses',
      passed: false,
      readings: [],
      failures: [`could not read the fuse wire: ${(error as Error).message}`],
    }
  }
}

// Only meaningful on a signed app: an unsigned package carries no entitlements anywhere, which
// would read as a missing `allow-jit` on every process that runs V8. So an unsigned build records
// the assertion as one that did not run, and the publish gate refuses it on `signed` instead.
export function entitlementsAssertion(
  appPath: string,
  appName: string,
  { signed }: { signed: boolean },
): Assertion & { ran: boolean; readings: EntitlementReading[]; failures: string[] } {
  if (!signed) {
    return {
      name: 'entitlements',
      passed: false,
      ran: false,
      readings: [],
      failures: ['the app is not signed'],
    }
  }
  try {
    const readings = readEntitlements(appPath, appName)
    const failures = entitlementFailures(readings)
    return { name: 'entitlements', passed: failures.length === 0, ran: true, readings, failures }
  } catch (error) {
    return {
      name: 'entitlements',
      passed: false,
      ran: true,
      readings: [],
      failures: [(error as Error).message],
    }
  }
}

// #1769's artifact tier writes its outcomes with `--json`. Reading them here rather than re-running
// the launch keeps one implementation of the acceptance run.
/** One architecture's acceptance outcome, as `--json` wrote it. */
type AcceptanceOutcome = { ok?: boolean; failures?: string[] }

export function packagedPtyAssertion(
  outcomesPath: string,
): Assertion & { outcomes: AcceptanceOutcome[]; failures: string[] } {
  let outcomes: AcceptanceOutcome[]
  try {
    outcomes = JSON.parse(readFileSync(outcomesPath, 'utf8'))
  } catch (error) {
    return {
      name: 'packagedPty',
      passed: false,
      outcomes: [],
      failures: [`no acceptance result at ${outcomesPath}: ${(error as Error).message}`],
    }
  }
  if (!Array.isArray(outcomes) || outcomes.length === 0) {
    return {
      name: 'packagedPty',
      passed: false,
      outcomes: [],
      failures: [`${outcomesPath} records no acceptance run`],
    }
  }
  const failures = outcomes
    .filter((outcome) => !outcome.ok)
    .flatMap((outcome) => outcome.failures ?? [])
  return { name: 'packagedPty', passed: failures.length === 0, outcomes, failures }
}

export function signingAssertion<T extends Pick<SigningStatus, 'signed' | 'notarized'>>(
  status: T,
): Assertion & T & { failures: string[] } {
  const failures: string[] = []
  if (!status.signed) failures.push('the app carries no Developer ID signature')
  if (!status.notarized) failures.push('the app carries no stapled notarization ticket')
  return { name: 'signing', passed: failures.length === 0, ...status, failures }
}
