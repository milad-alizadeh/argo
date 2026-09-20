import { AGENT_RECOMMENDATIONS } from './onboarding-agent-recommendations'
import { HARNESS_RECOMMENDATIONS } from './onboarding-harness-recommendations'
import type { OnboardingState } from './onboarding-model'
import { PROJECT_RECOMMENDATIONS } from './onboarding-project-recommendations'
import { INITIAL_TARGETS } from './onboarding-targets'

const DEFAULT_MANUAL_SOURCE = `${JSON.stringify(
  {
    version: 1,
    targets: {
      desktop: {
        path: 'apps/desktop',
        start: 'bun run dev',
        build: 'bun run build',
        test: 'bun run test',
      },
      skills: {
        path: 'packages/argo-skills',
        start: 'bun run skills:preview',
        build: 'bun run skills:build',
        test: 'bun run test:skills',
      },
    },
  },
  null,
  2,
)}\n`

export function initialState(): OnboardingState {
  return {
    analysisStep: 0,
    applyStep: 0,
    defaultHarness: 'claude',
    event: 'choose-folder',
    failureTargetId: null,
    harness: 'claude',
    manualSource: DEFAULT_MANUAL_SOURCE,
    manualValidated: false,
    method: null,
    planOutcome: 'ready',
    projectPath: '/Users/milad/Developer/argo',
    repositoryRecommendations: structuredClone([
      ...AGENT_RECOMMENDATIONS,
      ...PROJECT_RECOMMENDATIONS,
      ...HARNESS_RECOMMENDATIONS,
    ]),
    skippedSetup: false,
    stage: 'folder',
    targets: structuredClone(INITIAL_TARGETS),
    waitingTaskId: null,
  }
}
