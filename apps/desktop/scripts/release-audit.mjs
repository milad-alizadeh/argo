// The backstop's reading of a release that is already published (ADR-0036,
// [#1807](https://github.com/milad-alizadeh/argo/issues/1807)). Separate from `release-verdict.mjs`
// because it runs at a different time, on a different machine, and against a release rather than a
// build: the verdict is written before the publish, and this is read after it.
import { VERDICT_FILENAME } from './release-verdict.mjs'

// It answers with one of three cases, because the issue it files has to say which one it hit: the
// verdict is not there, the verdict says the build failed, or the verdict is for other bytes than
// these.
//
// The third is what stops a passing verdict being inherited. A release carrying the previous
// release's verdict would otherwise read as gated.
export function releaseAudit(verdict, assetDigests) {
  if (!verdict) {
    return { case: 'verdict missing', reasons: ['the release carries no release-verdict.json'] }
  }
  if (!verdict.passed) {
    return {
      case: 'verdict failing',
      reasons: verdict.failures ?? ['the verdict does not pass and says no more'],
    }
  }
  const judged = new Set((verdict.artifacts ?? []).map((artifact) => artifact.sha256))
  // The verdict is an asset of the release it judges, so it can never be in its own hash list.
  const uncovered = assetDigests
    .filter((asset) => asset.name !== VERDICT_FILENAME && !judged.has(asset.sha256))
    .map((asset) => `${asset.name} (${asset.sha256}) is not in the verdict's hash list`)
  if (uncovered.length > 0) return { case: 'verdict failing', reasons: uncovered }
  return { case: 'passed', reasons: [] }
}
