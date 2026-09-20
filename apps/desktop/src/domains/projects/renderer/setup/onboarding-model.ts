export type OnboardingHarness = 'codex' | 'claude'
export type OnboardingMethod = 'agent' | 'manual'
export type OnboardingPlanOutcome = 'ready' | 'needs-input' | 'cannot-plan' | 'malformed'
export type OnboardingStage =
  | 'folder'
  | 'method'
  | 'no-default'
  | 'harness'
  | 'analyzing'
  | 'recommendations'
  | 'customize'
  | 'project-setup'
  | 'manual'
  | 'applying'
  | 'apply-failed'
  | 'starting'
  | 'complete'

export type OnboardingRecommendation = {
  accepted: boolean
  bundledDependencies?: string[]
  copyKey: string
  effect?: string
  group?: 'project-files' | 'agent-skills' | 'harness-settings'
  href: string
  id: string
  icon: string
  kind: 'action' | 'tool' | 'dependency'
  waitsForUser?: boolean
}

export type OnboardingTarget = {
  buildCommand: string
  existingTools: string[]
  framework: string
  id: string
  name: string
  packageManager: string
  path: string
  recommendations: OnboardingRecommendation[]
  startCommand: string
  testCommand: string
}

export type OnboardingApplyTask = {
  detail: string
  id: string
  kind: 'prepare' | 'action' | 'install' | 'verify'
  label: string
  recommendationId?: string
  targetId?: string
  waitsForUser?: boolean
}

export type OnboardingState = {
  analysisStep: number
  applyStep: number
  defaultHarness: OnboardingHarness | null
  event: string
  failureTargetId: string | null
  harness: OnboardingHarness
  manualSource: string
  manualValidated: boolean
  method: OnboardingMethod | null
  planOutcome: OnboardingPlanOutcome
  projectPath: string
  repositoryRecommendations: OnboardingRecommendation[]
  skippedSetup: boolean
  stage: OnboardingStage
  targets: OnboardingTarget[]
  waitingTaskId: string | null
}

export type OnboardingTargetPatch = Partial<Omit<OnboardingTarget, 'id' | 'recommendations'>>

export type OnboardingController = {
  state: OnboardingState
  actions: {
    addTarget: () => void
    apply: () => void
    back: () => void
    beginAnalysis: () => void
    chooseFolder: () => void
    chooseMethod: (method: OnboardingMethod) => void
    configureDefaultHarness: (harness: OnboardingHarness) => void
    continueApply: () => void
    editFailedTarget: () => void
    openCustomization: () => void
    openFolder: () => void
    openProjectSetup: () => void
    removeTarget: (targetId: string) => void
    retryApply: () => void
    retryAnalysis: () => void
    setDefaultHarness: (harness: OnboardingHarness | null) => void
    setFailureTarget: (targetId: string | null) => void
    setHarness: (harness: OnboardingHarness) => void
    setManualSource: (source: string) => void
    setPlanOutcome: (outcome: OnboardingPlanOutcome) => void
    skipSetup: () => void
    validateManualSource: () => void
    resolvePlanInput: () => void
    toggleRepositoryRecommendation: (recommendationId: string) => void
    toggleTargetRecommendation: (targetId: string, recommendationId: string) => void
    updateRepositoryRecommendation: (recommendationId: string, effect: string) => void
    updateTarget: (targetId: string, patch: OnboardingTargetPatch) => void
    updateTargetRecommendation: (targetId: string, recommendationId: string, effect: string) => void
  }
}
