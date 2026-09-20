import type { SetOnboardingState } from './onboarding-controller-types'
import { ANALYSIS_TASKS, BACK_STAGE, methodSelection } from './onboarding-flow'
import type { OnboardingController } from './onboarding-model'

type NavigationActions = Pick<
  OnboardingController['actions'],
  | 'back'
  | 'beginAnalysis'
  | 'chooseFolder'
  | 'chooseMethod'
  | 'configureDefaultHarness'
  | 'editFailedTarget'
  | 'openCustomization'
  | 'openFolder'
  | 'openProjectSetup'
  | 'retryAnalysis'
>

type ApplicationActions = Pick<
  OnboardingController['actions'],
  'apply' | 'continueApply' | 'retryApply' | 'resolvePlanInput' | 'skipSetup'
>

export function onboardingFlowActions(setState: SetOnboardingState) {
  return { ...navigationActions(setState), ...applicationActions(setState) }
}

function navigationActions(setState: SetOnboardingState): NavigationActions {
  return {
    back: () =>
      setState((current) => ({
        ...current,
        event: 'back',
        stage: BACK_STAGE[current.stage] ?? current.stage,
      })),
    beginAnalysis: () =>
      setState((current) => ({
        ...current,
        analysisStep: 0,
        event: `analysis-${ANALYSIS_TASKS[0].id}`,
        stage: 'analyzing',
      })),
    chooseFolder: () =>
      setState((current) => ({ ...current, event: 'folder-selected', stage: 'method' })),
    chooseMethod: (method) =>
      setState((current) => ({ ...current, ...methodSelection(current, method) })),
    configureDefaultHarness: (harness) =>
      setState((current) => ({
        ...current,
        defaultHarness: harness,
        event: 'default-harness-configured',
        harness,
        stage: 'method',
      })),
    editFailedTarget: () =>
      setState((current) => ({
        ...current,
        event: 'failed-target-editing',
        stage: current.method === 'manual' ? 'manual' : 'customize',
      })),
    openCustomization: () =>
      setState((current) => ({ ...current, event: 'customization-opened', stage: 'customize' })),
    openFolder: () =>
      setState((current) => ({ ...current, event: 'folder-opened', stage: 'folder' })),
    openProjectSetup: () =>
      setState((current) => ({
        ...current,
        event: 'project-setup-opened',
        stage: 'project-setup',
      })),
    retryAnalysis: () =>
      setState((current) => ({
        ...current,
        analysisStep: 0,
        event: 'analysis-restarted',
        planOutcome: 'ready',
        stage: 'analyzing',
      })),
  }
}

function applicationActions(setState: SetOnboardingState): ApplicationActions {
  return {
    apply: () =>
      setState((current) =>
        current.method === 'manual'
          ? { ...current, event: 'manual-saved', stage: 'complete', waitingTaskId: null }
          : {
              ...current,
              applyStep: 0,
              event: 'apply-started',
              stage: 'applying',
              waitingTaskId: null,
            },
      ),
    continueApply: () =>
      setState((current) => ({
        ...current,
        applyStep: current.applyStep + 1,
        event: 'task-continued',
        waitingTaskId: null,
      })),
    retryApply: () =>
      setState((current) => ({
        ...current,
        event: 'apply-retrying',
        failureTargetId: null,
        stage: 'applying',
        waitingTaskId: null,
      })),
    resolvePlanInput: () =>
      setState((current) => ({ ...current, event: 'plan-input-resolved', planOutcome: 'ready' })),
    skipSetup: () =>
      setState((current) => ({
        ...current,
        event: 'setup-skipped',
        method: null,
        skippedSetup: true,
        stage: 'complete',
        targets: [],
      })),
  }
}
