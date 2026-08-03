import { describe, expect, it } from 'vitest'
import { parseHeadFacts } from './headFacts'

// Captured verbatim from `git status --porcelain=v2 --branch` on git 2.50.1.
const AHEAD_OF_UPSTREAM = `# branch.oid c647263078baed1bcbace41365994e35f2eedacb
# branch.head main
# branch.upstream origin/main
# branch.ab +1 -0
`

const DETACHED = `# branch.oid de8b6c5863fb8f4039f71a9bfb85cc94033f5528
# branch.head (detached)
`

const NO_UPSTREAM = `# branch.oid 2ddf1b1f2ca208ec83440342ad05c16a15d2a315
# branch.head argo/#264-app-shell
1 .M N... 100644 100644 100644 3ad1697313e4e79e10a23ae7a41755fe64497c3d 3ad1697313e4e79e10a23ae7a41755fe64497c3d apps/desktop/src/renderer/src/styles/argo-tokens.css
`

describe('the primary checkout', () => {
  it('reads the checked-out branch and how far it has drifted from its upstream', () => {
    expect(parseHeadFacts(AHEAD_OF_UPSTREAM)).toEqual({ branch: 'main', ahead: 1, behind: 0 })
  })

  it('labels a detached HEAD with its short sha, the only name git has for it', () => {
    expect(parseHeadFacts(DETACHED)).toEqual({ branch: 'de8b6c5', ahead: 0, behind: 0 })
  })

  it('reports no drift for a branch that tracks nothing', () => {
    expect(parseHeadFacts(NO_UPSTREAM)).toEqual({
      branch: 'argo/#264-app-shell',
      ahead: 0,
      behind: 0,
    })
  })
})
