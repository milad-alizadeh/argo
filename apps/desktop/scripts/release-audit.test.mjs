// The backstop's side of #1807: what `release-backstop.yml` decides about a release that is
// already published. It never needs a Mac, a certificate or an artifact — it reads a verdict
// document and a list of asset digests, both plain data.
import { describe, expect, test } from 'bun:test'
import { releaseAudit } from './release-audit.mjs'

describe('auditing a release that is already published', () => {
  const zip = { name: 'Argo-darwin-arm64-1.2.0.zip', bytes: 4, sha256: 'aaa' }
  const verdict = { passed: true, failures: [], artifacts: [zip] }
  const assets = [zip, { name: 'release-verdict.json', bytes: 2, sha256: 'bbb' }]

  test('leaves a release whose verdict covers its assets alone', () => {
    expect(releaseAudit(verdict, assets).case).toBe('passed')
  })

  test('names the case when the release carries no verdict', () => {
    const audit = releaseAudit(null, assets)
    expect(audit.case).toBe('verdict missing')
    expect(audit.reasons).toEqual(['the release carries no release-verdict.json'])
  })

  test("carries the verdict's own failures through when it says the build failed", () => {
    const audit = releaseAudit(
      { passed: false, failures: ['signing: the app is not signed'], artifacts: [] },
      assets,
    )
    expect(audit.case).toBe('verdict failing')
    expect(audit.reasons).toEqual(['signing: the app is not signed'])
  })

  // The hash list is what stops a verdict being inherited: a release carrying the previous
  // release's verdict would otherwise read as gated.
  test('refuses an asset the verdict never judged', () => {
    const audit = releaseAudit(verdict, [
      { name: 'Argo-darwin-arm64-1.2.0.zip', bytes: 9, sha256: 'ccc' },
    ])
    expect(audit.case).toBe('verdict failing')
    expect(audit.reasons[0]).toContain("is not in the verdict's hash list")
  })

  // The verdict is an asset of the release it judges, so it can never be in its own hash list.
  test('does not ask the verdict to cover itself', () => {
    const assetsWithOtherVerdict = [zip, { name: 'release-verdict.json', bytes: 2, sha256: 'ddd' }]
    expect(releaseAudit(verdict, assetsWithOtherVerdict).case).toBe('passed')
  })
})
