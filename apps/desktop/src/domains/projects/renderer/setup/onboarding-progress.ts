import { useEffect } from 'react'
import { applyTasksFor } from './onboarding-apply-tasks'
import type { SetOnboardingState } from './onboarding-controller-types'
import { ANALYSIS_TASKS } from './onboarding-flow'
import type { OnboardingState } from './onboarding-model'

export function useOnboardingProgress(
  state: OnboardingState,
  setState: SetOnboardingState,
  pauseProgress: boolean,
) {
  useAnalysisProgress(state, setState, pauseProgress)
  useApplicationProgress(state, setState, pauseProgress)
  useStartProgress(state, setState, pauseProgress)
}

function useAnalysisProgress(
  state: OnboardingState,
  setState: SetOnboardingState,
  pauseProgress: boolean,
) {
  useEffect(() => {
    if (pauseProgress || state.stage !== 'analyzing') return
    const analysisStep = state.analysisStep
    const timeout = window.setTimeout(
      () =>
        setState((current) =>
          analysisStep < ANALYSIS_TASKS.length - 1
            ? {
                ...current,
                analysisStep: analysisStep + 1,
                event: `analysis-${ANALYSIS_TASKS[analysisStep + 1]?.id}`,
              }
            : {
                ...current,
                event: current.planOutcome === 'ready' ? 'plan-ready' : 'planning-boundary',
                stage: 'recommendations',
              },
        ),
      1_050,
    )
    return () => window.clearTimeout(timeout)
  }, [pauseProgress, setState, state.analysisStep, state.stage])
}

function useApplicationProgress(
  state: OnboardingState,
  setState: SetOnboardingState,
  pauseProgress: boolean,
) {
  useEffect(() => {
    if (pauseProgress || state.stage !== 'applying') return
    const task = applyTasksFor(state)[state.applyStep]
    if (!task) {
      setState((current) => ({ ...current, event: 'tasks-passed', stage: 'starting' }))
      return
    }
    if (task.waitsForUser) {
      if (state.waitingTaskId !== task.id)
        setState((current) => ({ ...current, event: 'task-waiting', waitingTaskId: task.id }))
      return
    }
    const timeout = window.setTimeout(
      () =>
        setState((current) =>
          task.kind === 'verify' && task.targetId === state.failureTargetId
            ? { ...current, event: 'task-failed', stage: 'apply-failed' }
            : {
                ...current,
                applyStep: current.applyStep + 1,
                event: 'task-passed',
                waitingTaskId: null,
              },
        ),
      850,
    )
    return () => window.clearTimeout(timeout)
  }, [pauseProgress, setState, state])
}

function useStartProgress(
  state: OnboardingState,
  setState: SetOnboardingState,
  pauseProgress: boolean,
) {
  useEffect(() => {
    if (pauseProgress || state.stage !== 'starting') return
    const timeout = window.setTimeout(
      () => setState((current) => ({ ...current, event: 'project-started', stage: 'complete' })),
      950,
    )
    return () => window.clearTimeout(timeout)
  }, [pauseProgress, setState, state.stage])
}
