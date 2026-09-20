// THROWAWAY PROTOTYPE (#2464): three Project onboarding directions on the existing cockpit route.
import { ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react'
import { type ComponentType, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Button } from '@/platform/renderer/components/ui/button'
import {
  PROJECT_ONBOARDING_DEFAULT_VARIANT,
  PROJECT_ONBOARDING_PROTOTYPE_KEY,
  PROJECT_ONBOARDING_PROTOTYPE_VALUE,
  PROJECT_ONBOARDING_VARIANT_KEY,
} from '@/platform/shared/project-onboarding-prototype'
import {
  ProjectOnboardingVariantA,
  ProjectOnboardingVariantB,
  ProjectOnboardingVariantC,
} from './project-onboarding-prototype-variants'
import './project-setup.css'
import './project-onboarding-prototype.css'

export type PrototypeVariant = 'A' | 'B' | 'C'
export type PrototypeEntryPoint = 'empty' | 'selector'
export type PrototypeHarness = 'codex' | 'claude'
export type PrototypeMethod = 'agent' | 'manual'
export type PrototypePlanOutcome = 'ready' | 'needs-input' | 'cannot-plan' | 'malformed'
export type PrototypeStage =
  | 'entry'
  | 'folder'
  | 'method'
  | 'no-default'
  | 'harness'
  | 'analyzing'
  | 'recommendations'
  | 'customize'
  | 'project-setup'
  | 'manual'
  | 'review'
  | 'applying'
  | 'apply-failed'
  | 'starting'
  | 'complete'

export type PrototypeRecommendation = {
  accepted: boolean
  bundledDependencies?: string[]
  effect: string
  group?: 'project-files' | 'agent-skills' | 'harness-settings'
  href: string
  id: string
  icon: string
  kind: 'action' | 'tool' | 'dependency'
  label: string
  reason: string
  waitsForUser?: boolean
}

export type PrototypeTarget = {
  buildCommand: string
  existingTools: string[]
  framework: string
  id: string
  name: string
  packageManager: string
  path: string
  recommendations: PrototypeRecommendation[]
  startCommand: string
  testCommand: string
}

export type PrototypeApplyTask = {
  detail: string
  id: string
  kind: 'prepare' | 'action' | 'install' | 'verify'
  label: string
  targetId?: string
  waitsForUser?: boolean
}

export type PrototypeState = {
  analysisStep: number
  applyStep: number
  defaultHarness: PrototypeHarness | null
  entryPoint: PrototypeEntryPoint
  event: string
  failureTargetId: string | null
  harness: PrototypeHarness
  manualSource: string
  manualValidated: boolean
  method: PrototypeMethod | null
  planOutcome: PrototypePlanOutcome
  planRevisionAccepted: boolean
  projectPath: string
  repositoryRecommendations: PrototypeRecommendation[]
  skippedSetup: boolean
  stage: PrototypeStage
  targets: PrototypeTarget[]
  waitingTaskId: string | null
}

type TargetPatch = Partial<Omit<PrototypeTarget, 'id' | 'recommendations'>>

export type PrototypeController = {
  state: PrototypeState
  actions: {
    addTarget: () => void
    apply: () => void
    back: () => void
    beginAnalysis: () => void
    chooseFolder: () => void
    chooseMethod: (method: PrototypeMethod) => void
    configureDefaultHarness: (harness: PrototypeHarness) => void
    continueApply: () => void
    editFailedTarget: () => void
    openCustomization: () => void
    openEntry: (entryPoint: PrototypeEntryPoint) => void
    openFolder: () => void
    openProjectSetup: () => void
    openReview: () => void
    removeTarget: (targetId: string) => void
    reset: () => void
    retryApply: () => void
    retryAnalysis: () => void
    finishSetup: () => void
    setDefaultHarness: (harness: PrototypeHarness | null) => void
    setFailureTarget: (targetId: string | null) => void
    setHarness: (harness: PrototypeHarness) => void
    setManualSource: (source: string) => void
    setPlanOutcome: (outcome: PrototypePlanOutcome) => void
    skipSetup: () => void
    validateManualSource: () => void
    resolvePlanInput: () => void
    toggleRepositoryRecommendation: (recommendationId: string) => void
    toggleTargetRecommendation: (targetId: string, recommendationId: string) => void
    updateRepositoryRecommendation: (recommendationId: string, effect: string) => void
    updateTarget: (targetId: string, patch: TargetPatch) => void
    updateTargetRecommendation: (targetId: string, recommendationId: string, effect: string) => void
  }
}

const INITIAL_TARGETS: PrototypeTarget[] = [
  {
    buildCommand: 'bun run build',
    existingTools: ['Biome', 'Vitest'],
    framework: 'Electron · React · Vite',
    id: 'desktop',
    name: 'Desktop app',
    path: 'apps/desktop',
    recommendations: [
      {
        accepted: true,
        bundledDependencies: ['@storybook/react-vite'],
        effect: 'Add component and screen review to this Target’s setup handoff.',
        href: 'https://storybook.js.org/',
        id: 'storybook',
        icon: 'storybook',
        kind: 'tool',
        label: 'Storybook',
        reason: 'Build and test UI components in isolation for faster review.',
      },
      {
        accepted: true,
        bundledDependencies: ['@playwright/test'],
        effect: 'Add packaged desktop journeys to this Target’s required verification.',
        href: 'https://playwright.dev/',
        id: 'playwright',
        icon: 'playwright',
        kind: 'tool',
        label: 'Playwright journeys',
        reason: 'Run reliable end-to-end tests across critical user journeys.',
      },
    ],
    packageManager: 'Bun',
    startCommand: 'bun run dev',
    testCommand: 'bun run test',
  },
  {
    buildCommand: 'bun run skills:build',
    existingTools: ['Skills CLI', 'RTK'],
    framework: 'Markdown skill bundle',
    id: 'skills',
    name: 'Argo skills',
    path: 'packages/argo-skills',
    recommendations: [
      {
        accepted: true,
        bundledDependencies: ['markdownlint-cli2'],
        effect: 'Add instruction linting to this Target’s required verification.',
        href: 'https://github.com/DavidAnson/markdownlint-cli2',
        id: 'markdown-checks',
        icon: 'quality',
        kind: 'tool',
        label: 'Markdown checks',
        reason: 'Lint Markdown quickly and consistently to keep instructions readable.',
      },
      {
        accepted: false,
        bundledDependencies: ['typedoc'],
        effect: 'Install TypeDoc and add generated reference output for this Target.',
        href: 'https://typedoc.org/',
        id: 'typedoc',
        icon: 'docs',
        kind: 'dependency',
        label: 'TypeDoc',
        reason: 'Turn TypeScript comments into searchable HTML documentation.',
      },
    ],
    packageManager: 'Bun',
    startCommand: 'bun run skills:preview',
    testCommand: 'bun run test:skills',
  },
]

const INITIAL_REPOSITORY_RECOMMENDATIONS: PrototypeRecommendation[] = [
  {
    accepted: true,
    effect: 'Install the Argo skill bundle for Claude Code and Codex. Update the skill lock file.',
    group: 'agent-skills',
    href: 'https://github.com/milad-alizadeh/argo/tree/main/packages/argo-skills',
    id: 'argo-skill-bundle',
    icon: 'argo-skills',
    kind: 'action',
    label: 'Argo agent skills',
    reason:
      'Install Argo’s skills for quality gates, domain docs, agent instructions, interface review, and shipping.',
  },
  {
    accepted: true,
    effect: 'Add Bun and test filters to .rtk/filters.toml. Keep existing filters.',
    group: 'project-files',
    href: 'https://github.com/milad-alizadeh/argo/blob/main/.rtk/filters.toml',
    id: 'rtk-filters',
    icon: 'terminal',
    kind: 'action',
    label: 'RTK output filters',
    reason:
      'Add .rtk/filters.toml rules that keep errors and remove repeated noise from Bun and test output.',
  },
  {
    accepted: true,
    effect:
      'Update biome.jsonc, package scripts, and CI so required quality checks fail the build.',
    group: 'project-files',
    href: 'https://github.com/milad-alizadeh/argo/tree/main/packages/argo-skills/skills/setup-quality-gates',
    id: 'quality-gates',
    icon: 'quality',
    kind: 'action',
    label: 'CI quality gates',
    reason:
      'Update Biome, package scripts, and CI so lint, type, test, and Project structure failures block review.',
  },
  {
    accepted: true,
    effect: 'Enable update_plan in the global Codex configuration. Codex must restart.',
    group: 'harness-settings',
    href: 'https://github.com/milad-alizadeh/argo/tree/main/packages/argo-skills',
    id: 'codex-todos',
    icon: 'tasks',
    kind: 'action',
    label: 'Codex task checklist',
    reason: 'Show live progress while Codex works through a multi-step task.',
  },
  {
    accepted: true,
    effect:
      'Add task tracking, model choice, and writing rules to the Project’s agent instruction files.',
    group: 'project-files',
    href: 'https://github.com/milad-alizadeh/argo/tree/main/packages/argo-skills/skills/setup-argo-skills/templates',
    id: 'agent-instructions',
    icon: 'project-docs',
    kind: 'action',
    label: 'Project agent instructions',
    reason: 'Add task, model, and writing rules to AGENTS.md and each harness instruction file.',
  },
  {
    accepted: true,
    effect:
      'Copy hooks.json and hooks/. Add a worktree rules document when needed, then generate the Claude Code and Codex hook files.',
    group: 'project-files',
    href: 'https://github.com/milad-alizadeh/argo/blob/main/hooks.json',
    id: 'guardrail-hooks',
    icon: 'guards',
    kind: 'action',
    label: 'Agent guard hooks',
    reason:
      'Enforce worktree and push rules, copy skills into new worktrees, prompt for task tracking, and clean landed worktrees.',
  },
  {
    accepted: true,
    effect: 'Install the selected engineering skills for Claude Code and Codex.',
    group: 'agent-skills',
    href: 'https://github.com/mattpocock/skills',
    id: 'matt-pocock',
    icon: 'workflow',
    kind: 'action',
    label: 'Engineering workflow skills',
    reason:
      'Install skills for planning, TDD, debugging, and review. Choose issue tracking and the domain-doc layout during apply.',
    waitsForUser: true,
  },
  {
    accepted: true,
    effect: 'Install writing-for-agents and simple-english for Claude Code and Codex.',
    group: 'agent-skills',
    href: 'https://github.com/milad-alizadeh/argo/tree/main/packages/argo-skills',
    id: 'writing-skills',
    icon: 'writing',
    kind: 'dependency',
    label: 'Writing skills',
    reason:
      'Install writing-for-agents and simple-english for precise instructions and clear product copy.',
  },
  {
    accepted: true,
    effect: 'Add interface-review to the Project’s required UI review process.',
    group: 'project-files',
    href: 'https://github.com/milad-alizadeh/argo/tree/main/packages/argo-skills/skills/interface-review',
    id: 'interface-review',
    icon: 'interface-review',
    kind: 'action',
    label: 'UI review rules',
    reason:
      'Require UI work to be checked for usability, accessibility, responsiveness, and visual polish.',
  },
  {
    accepted: false,
    effect: 'Run a visual direction session and write docs/visual-direction.md.',
    group: 'project-files',
    href: 'https://github.com/milad-alizadeh/argo/tree/main/packages/argo-skills/skills/visual-exploration',
    id: 'visual-direction',
    icon: 'visual-direction',
    kind: 'action',
    label: 'Visual direction file',
    reason:
      'Explore design options and save the approved colors, type, spacing, and component style in docs/visual-direction.md.',
  },
  {
    accepted: true,
    effect: 'Run audit-agent-docs last and fix the Project’s agent instruction files.',
    group: 'project-files',
    href: 'https://github.com/milad-alizadeh/argo/tree/main/packages/argo-skills/skills/audit-agent-docs',
    id: 'agent-doc-audit',
    icon: 'audit',
    kind: 'action',
    label: 'Agent instruction audit',
    reason:
      'Check AGENTS.md and harness instructions for missing, stale, or conflicting rules, then fix them.',
  },
]

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

function initialState(entryPoint: PrototypeEntryPoint = 'empty'): PrototypeState {
  return {
    analysisStep: 0,
    applyStep: 0,
    defaultHarness: 'claude',
    entryPoint,
    event:
      entryPoint === 'empty'
        ? 'Prototype opened from the empty Project page.'
        : 'Prototype opened from the Project selector.',
    failureTargetId: null,
    harness: 'claude',
    manualSource: DEFAULT_MANUAL_SOURCE,
    manualValidated: false,
    method: null,
    planOutcome: 'ready',
    planRevisionAccepted: false,
    projectPath: '/Users/milad/Developer/argo',
    repositoryRecommendations: structuredClone(INITIAL_REPOSITORY_RECOMMENDATIONS),
    skippedSetup: false,
    stage: 'entry',
    targets: structuredClone(INITIAL_TARGETS),
    waitingTaskId: null,
  }
}

const BACK_STAGE: Partial<Record<PrototypeStage, PrototypeStage>> = {
  folder: 'entry',
  method: 'folder',
  'no-default': 'method',
  harness: 'method',
  analyzing: 'method',
  recommendations: 'method',
  customize: 'recommendations',
  'project-setup': 'recommendations',
  manual: 'method',
  review: 'project-setup',
  applying: 'review',
  'apply-failed': 'review',
  starting: 'review',
  complete: 'review',
}

const VARIANT_NAMES: Record<PrototypeVariant, string> = {
  A: 'Setup runway',
  B: 'Cockpit inspector',
  C: 'Agent briefing',
}

const VARIANTS = Object.keys(VARIANT_NAMES) as PrototypeVariant[]

export const ANALYSIS_TASKS = [
  {
    label: 'Inspect the Project folder',
    detail: 'Read manifests, README files, AGENTS.md, and CI configuration.',
  },
  { label: 'Identify Targets', detail: 'Find each runnable Target inside the Project.' },
  { label: 'Resolve commands', detail: 'Find start, build, and test commands for every Target.' },
  {
    label: 'Audit Project setup',
    detail: 'Detect automation, linters, UI tools, worktree rules, and Project conventions.',
  },
  {
    label: 'Recommend setup capabilities',
    detail: 'Cover Argo setup, quality gates, agent docs, engineering skills, and UI direction.',
  },
  {
    label: 'Define verification',
    detail: 'Prepare the required checks that each retained Target must pass.',
  },
] as const

export function targetsFromManualSource(source: string): PrototypeTarget[] | null {
  try {
    const parsed: unknown = JSON.parse(source)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
    const targets = (parsed as Record<string, unknown>).targets
    if (typeof targets !== 'object' || targets === null || Array.isArray(targets)) return null
    const configured = Object.entries(targets).map(([id, value]) =>
      targetFromManualValue(id, value),
    )
    if (configured.some((target) => target === null)) return null
    return configured as PrototypeTarget[]
  } catch {
    return null
  }
}

function targetFromManualValue(id: string, value: unknown): PrototypeTarget | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const target = value as Record<string, unknown>
  const { path, start, build, test } = target
  if (![path, start, build, test].every((item) => item === undefined || typeof item === 'string')) {
    return null
  }
  return {
    buildCommand: typeof build === 'string' ? build : '',
    existingTools: [],
    framework: 'Not inspected in manual setup',
    id,
    name: id.replaceAll('-', ' '),
    packageManager: 'Not inspected in manual setup',
    path: typeof path === 'string' ? path : '',
    recommendations: [],
    startCommand: typeof start === 'string' ? start : '',
    testCommand: typeof test === 'string' ? test : '',
  }
}

export function applyTasksFor(state: PrototypeState): PrototypeApplyTask[] {
  if (state.method === 'manual') return []
  const repositoryInstall = state.repositoryRecommendations.some(({ accepted }) => accepted)
    ? state.repositoryRecommendations
        .filter(({ accepted }) => accepted)
        .map((recommendation) => ({
          detail: appliedRecommendationDetail(recommendation),
          id: `repository-${recommendation.id}`,
          kind: 'action' as const,
          label: recommendation.label,
          waitsForUser: recommendation.waitsForUser,
        }))
    : []
  return [
    {
      detail: 'Write the approved Project, Target, and recommendation handoff.',
      id: 'write-setup',
      kind: 'prepare',
      label: 'Write .argo/settings.json',
    },
    ...repositoryInstall,
    {
      detail: 'Confirm every accepted Project-wide action produced its approved effect.',
      id: 'verify-repository-setup',
      kind: 'verify',
      label: 'Verify Project-wide setup actions',
    },
    ...state.targets.flatMap((target) => {
      const install = target.recommendations
        .filter(({ accepted }) => accepted)
        .map((recommendation) => ({
          detail: appliedRecommendationDetail(recommendation),
          id: `install-${target.id}-${recommendation.id}`,
          kind: 'install' as const,
          label: `${recommendation.label} for ${target.name}`,
          targetId: target.id,
        }))
      return [
        ...install,
        {
          detail: `Run ${target.buildCommand || 'the configured build command'}.`,
          id: `build-${target.id}`,
          kind: 'verify' as const,
          label: `Build ${target.name}`,
          targetId: target.id,
        },
        {
          detail: `Run ${target.testCommand || 'the configured test command'}.`,
          id: `test-${target.id}`,
          kind: 'verify' as const,
          label: `Test ${target.name}`,
          targetId: target.id,
        },
      ]
    }),
  ]
}

function appliedRecommendationDetail(recommendation: PrototypeRecommendation) {
  const dependencies = recommendation.bundledDependencies?.length
    ? ` Install with: ${recommendation.bundledDependencies.join(', ')}.`
    : ''
  return `${recommendation.effect}${dependencies}`
}

function variantFrom(value: string | null): PrototypeVariant {
  return (
    VARIANTS.find((variant) => variant === value) ??
    (PROJECT_ONBOARDING_DEFAULT_VARIANT as PrototypeVariant)
  )
}

function methodSelection(current: PrototypeState, method: PrototypeMethod) {
  if (method === 'manual') {
    return { event: 'Selected manual setup.', method, stage: 'manual' as const }
  }
  if (!current.defaultHarness) {
    return {
      event: 'Choose a default harness before analysis.',
      method: null,
      stage: 'method' as const,
    }
  }
  return {
    analysisStep: 0,
    event: 'The setup agent started analysis.',
    method,
    stage: 'analyzing' as const,
  }
}

function usePrototypeProgress(
  state: PrototypeState,
  setState: (update: (current: PrototypeState) => PrototypeState) => void,
) {
  useEffect(() => {
    if (state.stage !== 'analyzing') return
    const timeout = window.setTimeout(() => {
      if (state.analysisStep < ANALYSIS_TASKS.length - 1) {
        setState((current) => ({
          ...current,
          analysisStep: current.analysisStep + 1,
          event: ANALYSIS_TASKS[current.analysisStep + 1]?.label ?? current.event,
        }))
        return
      }
      setState((current) => ({
        ...current,
        event:
          current.planOutcome === 'ready'
            ? 'The setup plan is ready for review.'
            : 'Analysis reached a safe planning boundary.',
        stage: 'recommendations',
      }))
    }, 1_050)
    return () => window.clearTimeout(timeout)
  }, [setState, state.analysisStep, state.stage])

  useEffect(() => {
    if (state.stage !== 'applying') return
    const tasks = applyTasksFor(state)
    const task = tasks[state.applyStep]
    if (!task) {
      setState((current) => ({
        ...current,
        event: 'All required tasks passed.',
        stage: 'starting',
      }))
      return
    }
    if (task.waitsForUser) {
      if (state.waitingTaskId === task.id) return
      setState((current) => ({
        ...current,
        event: `${task.label} is waiting for your choice.`,
        waitingTaskId: task.id,
      }))
      return
    }
    const timeout = window.setTimeout(() => {
      if (task.kind === 'verify' && task.targetId === state.failureTargetId) {
        setState((current) => ({
          ...current,
          event: `${task.label} failed. The Project did not start.`,
          stage: 'apply-failed',
        }))
        return
      }
      setState((current) => ({
        ...current,
        applyStep: current.applyStep + 1,
        event: `${task.label} passed.`,
        waitingTaskId: null,
      }))
    }, 850)
    return () => window.clearTimeout(timeout)
  }, [setState, state])

  useEffect(() => {
    if (state.stage !== 'starting') return
    const timeout = window.setTimeout(
      () =>
        setState((current) => ({
          ...current,
          event: 'The Project started and its Targets are available.',
          stage: 'complete',
        })),
      950,
    )
    return () => window.clearTimeout(timeout)
  }, [setState, state.stage])
}

function usePrototypeController(): PrototypeController {
  const [state, setState] = useState<PrototypeState>(() => initialState())
  usePrototypeProgress(state, setState)
  const actions = useMemo<PrototypeController['actions']>(
    () => ({
      addTarget: () =>
        setState((current) => ({
          ...current,
          event: 'Added a new Target.',
          planRevisionAccepted: false,
          targets: [
            ...current.targets,
            {
              buildCommand: 'bun run build',
              existingTools: [],
              framework: 'Custom Target',
              id: `target-${current.targets.length + 1}`,
              name: `New Target ${current.targets.length + 1}`,
              packageManager: 'Bun',
              path: '.',
              recommendations: [],
              startCommand: 'bun run dev',
              testCommand: 'bun run test',
            },
          ],
        })),
      apply: () =>
        setState((current) => {
          if (current.method === 'manual') {
            return {
              ...current,
              event:
                'Saved the manual configuration in Argo. Argo did not inspect or run commands. Argo did not start any Target.',
              stage: 'complete',
              waitingTaskId: null,
            }
          }
          return {
            ...current,
            applyStep: 0,
            event: 'Applying the approved setup plan.',
            stage: 'applying',
            waitingTaskId: null,
          }
        }),
      back: () =>
        setState((current) => ({
          ...current,
          event: 'Moved back one step.',
          stage:
            current.stage === 'review' && current.method === 'manual'
              ? 'manual'
              : (BACK_STAGE[current.stage] ?? current.stage),
        })),
      beginAnalysis: () =>
        setState((current) => ({
          ...current,
          analysisStep: 0,
          event: ANALYSIS_TASKS[0].label,
          stage: 'analyzing',
        })),
      chooseFolder: () =>
        setState((current) => ({
          ...current,
          event: `Selected the Project folder ${current.projectPath}.`,
          stage: 'method',
        })),
      chooseMethod: (method) =>
        setState((current) => ({
          ...current,
          ...methodSelection(current, method),
        })),
      configureDefaultHarness: (harness) =>
        setState((current) => ({
          ...current,
          defaultHarness: harness,
          event: `${harness === 'codex' ? 'Codex' : 'Claude Code'} is now the default harness.`,
          harness,
          stage: 'method',
        })),
      continueApply: () =>
        setState((current) => ({
          ...current,
          applyStep: current.applyStep + 1,
          event: 'The application agent received your choice.',
          waitingTaskId: null,
        })),
      finishSetup: () =>
        setState((current) => ({
          ...current,
          event: 'Returned to Project setup.',
          skippedSetup: false,
          stage: 'method',
          targets: structuredClone(INITIAL_TARGETS),
        })),
      editFailedTarget: () =>
        setState((current) => ({
          ...current,
          event: 'Opened the failed Target for editing.',
          stage: current.method === 'manual' ? 'manual' : 'customize',
        })),
      openCustomization: () =>
        setState((current) => ({
          ...current,
          event: 'Opened Target customization.',
          planRevisionAccepted: false,
          stage: 'customize',
        })),
      openEntry: (entryPoint) =>
        setState((current) => ({
          ...initialState(entryPoint),
          defaultHarness: current.defaultHarness,
        })),
      openFolder: () =>
        setState((current) => ({
          ...current,
          event: 'Opened the Project folder chooser.',
          stage: 'folder',
        })),
      openReview: () =>
        setState((current) => ({
          ...current,
          event: 'Accepted the current plan revision for final review.',
          planRevisionAccepted: true,
          stage: 'review',
        })),
      openProjectSetup: () =>
        setState((current) => ({
          ...current,
          event: 'Opened Project-wide setup.',
          stage: 'project-setup',
        })),
      removeTarget: (targetId) =>
        setState((current) => ({
          ...current,
          event: 'Removed a Target from the plan.',
          planRevisionAccepted: false,
          targets: current.targets.filter(({ id }) => id !== targetId),
        })),
      reset: () => setState(initialState()),
      retryApply: () =>
        setState((current) => ({
          ...current,
          event: 'Retrying the failed Target task.',
          failureTargetId: null,
          stage: 'applying',
          waitingTaskId: null,
        })),
      retryAnalysis: () =>
        setState((current) => ({
          ...current,
          analysisStep: 0,
          event: 'Restarted safe Project analysis.',
          planOutcome: 'ready',
          stage: 'analyzing',
        })),
      skipSetup: () =>
        setState((current) => ({
          ...current,
          event: 'Setup was skipped. The Project opened without Targets or configuration.',
          method: null,
          skippedSetup: true,
          stage: 'complete',
          targets: [],
        })),
      setDefaultHarness: (defaultHarness) =>
        setState((current) => ({
          ...current,
          defaultHarness,
          event: defaultHarness
            ? 'A default harness is configured.'
            : 'No default harness is configured.',
        })),
      setFailureTarget: (failureTargetId) =>
        setState((current) => ({
          ...current,
          event: failureTargetId
            ? 'The first Target will fail verification.'
            : 'All Target tasks will pass.',
          failureTargetId,
        })),
      setHarness: (harness) => setState((current) => ({ ...current, harness })),
      setManualSource: (manualSource) =>
        setState((current) => ({ ...current, manualSource, manualValidated: false })),
      setPlanOutcome: (planOutcome) =>
        setState((current) => ({
          ...current,
          event: `The planning boundary will be ${planOutcome}.`,
          planOutcome,
        })),
      validateManualSource: () =>
        setState((current) => {
          const targets = targetsFromManualSource(current.manualSource)
          if (!targets) return current
          return {
            ...current,
            event: 'The JSON structure is valid.',
            manualValidated: true,
            targets,
          }
        }),
      toggleRepositoryRecommendation: (recommendationId) =>
        setState((current) => ({
          ...current,
          planRevisionAccepted: false,
          repositoryRecommendations: current.repositoryRecommendations.map((recommendation) =>
            recommendation.id === recommendationId
              ? { ...recommendation, accepted: !recommendation.accepted }
              : recommendation,
          ),
        })),
      toggleTargetRecommendation: (targetId, recommendationId) =>
        setState((current) => ({
          ...current,
          planRevisionAccepted: false,
          targets: current.targets.map((target) =>
            target.id === targetId
              ? {
                  ...target,
                  recommendations: target.recommendations.map((recommendation) =>
                    recommendation.id === recommendationId
                      ? { ...recommendation, accepted: !recommendation.accepted }
                      : recommendation,
                  ),
                }
              : target,
          ),
        })),
      updateTarget: (targetId, patch) =>
        setState((current) => ({
          ...current,
          event: 'Updated a Target.',
          planRevisionAccepted: false,
          targets: current.targets.map((target) =>
            target.id === targetId ? { ...target, ...patch } : target,
          ),
        })),
      updateRepositoryRecommendation: (recommendationId, effect) =>
        setState((current) => ({
          ...current,
          event: 'Customized a Project-wide setup effect.',
          planRevisionAccepted: false,
          repositoryRecommendations: current.repositoryRecommendations.map((recommendation) =>
            recommendation.id === recommendationId ? { ...recommendation, effect } : recommendation,
          ),
        })),
      updateTargetRecommendation: (targetId, recommendationId, effect) =>
        setState((current) => ({
          ...current,
          event: 'Customized a Target recommendation.',
          planRevisionAccepted: false,
          targets: current.targets.map((target) =>
            target.id === targetId
              ? {
                  ...target,
                  recommendations: target.recommendations.map((recommendation) =>
                    recommendation.id === recommendationId
                      ? { ...recommendation, effect }
                      : recommendation,
                  ),
                }
              : target,
          ),
        })),
      resolvePlanInput: () =>
        setState((current) => ({
          ...current,
          event: 'The agent incorporated your answer. The plan is ready for review.',
          planOutcome: 'ready',
        })),
    }),
    [],
  )
  return { actions, state }
}

export function ProjectOnboardingPrototype() {
  const [searchParams, setSearchParams] = useSearchParams()
  const controller = usePrototypeController()
  const variant = variantFrom(searchParams.get(PROJECT_ONBOARDING_VARIANT_KEY))
  const selectVariant = (nextVariant: PrototypeVariant) => {
    const next = new URLSearchParams(searchParams)
    next.set(PROJECT_ONBOARDING_PROTOTYPE_KEY, PROJECT_ONBOARDING_PROTOTYPE_VALUE)
    next.set(PROJECT_ONBOARDING_VARIANT_KEY, nextVariant)
    setSearchParams(next, { replace: true })
  }
  const cycle = (direction: -1 | 1) => {
    const currentIndex = VARIANTS.indexOf(variant)
    selectVariant(
      VARIANTS[(currentIndex + direction + VARIANTS.length) % VARIANTS.length] ??
        (PROJECT_ONBOARDING_DEFAULT_VARIANT as PrototypeVariant),
    )
  }
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return
      }
      if (event.key === 'ArrowLeft') cycle(-1)
      if (event.key === 'ArrowRight') cycle(1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })
  const VariantComponent = VARIANT_COMPONENTS[variant]
  return (
    <div className="prototype-root" data-prototype="project-onboarding">
      <div className="prototype-root__content">
        <VariantComponent controller={controller} />
      </div>
      <div className="prototype-dev-chrome">
        <PrototypeSwitcher next={() => cycle(1)} previous={() => cycle(-1)} variant={variant} />
        <PrototypeStatePanel controller={controller} variant={variant} />
      </div>
    </div>
  )
}

const VARIANT_COMPONENTS: Record<
  PrototypeVariant,
  ComponentType<{ controller: PrototypeController }>
> = {
  A: ProjectOnboardingVariantA,
  B: ProjectOnboardingVariantB,
  C: ProjectOnboardingVariantC,
}

function PrototypeStatePanel({
  controller,
  variant,
}: {
  controller: PrototypeController
  variant: PrototypeVariant
}) {
  const { actions, state } = controller
  const firstTarget = state.targets[0]
  return (
    <details className="prototype-state-panel">
      <summary>
        State · {state.entryPoint} / {state.stage}
      </summary>
      <div className="prototype-state-panel__body">
        <p>{state.event}</p>
        <dl>
          <div>
            <dt>Variant</dt>
            <dd>{variant}</dd>
          </div>
          <div>
            <dt>Method</dt>
            <dd>{state.method ?? 'not chosen'}</dd>
          </div>
          <div>
            <dt>Targets</dt>
            <dd>{state.targets.length}</dd>
          </div>
          <div>
            <dt>Harness</dt>
            <dd>{state.harness}</dd>
          </div>
          <div>
            <dt>Plan</dt>
            <dd>{state.planOutcome}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-1.5">
          <Button onClick={() => actions.openEntry('empty')} size="xs" variant="outline">
            Empty page
          </Button>
          <Button onClick={() => actions.openEntry('selector')} size="xs" variant="outline">
            Project selector
          </Button>
          <Button
            onClick={() => actions.setDefaultHarness(state.defaultHarness ? null : 'codex')}
            size="xs"
            variant="outline"
          >
            {state.defaultHarness ? 'Remove default' : 'Add default'}
          </Button>
          <Button
            onClick={() =>
              actions.setFailureTarget(state.failureTargetId ? null : (firstTarget?.id ?? null))
            }
            size="xs"
            variant="outline"
          >
            {state.failureTargetId ? 'Pass tasks' : 'Fail first Target'}
          </Button>
          <Button onClick={() => actions.setPlanOutcome('needs-input')} size="xs" variant="outline">
            Need input
          </Button>
          <Button onClick={() => actions.setPlanOutcome('cannot-plan')} size="xs" variant="outline">
            Cannot plan
          </Button>
          <Button onClick={() => actions.setPlanOutcome('malformed')} size="xs" variant="outline">
            Malformed
          </Button>
          <Button
            aria-label="Reset prototype"
            onClick={actions.reset}
            size="icon-xs"
            variant="ghost"
          >
            <RotateCcw />
          </Button>
        </div>
      </div>
    </details>
  )
}

function PrototypeSwitcher({
  next,
  previous,
  variant,
}: {
  next: () => void
  previous: () => void
  variant: PrototypeVariant
}) {
  return (
    <fieldset className="prototype-switcher" aria-label="Prototype variant">
      <Button aria-label="Previous variant" onClick={previous} size="icon-sm" variant="ghost">
        <ArrowLeft />
      </Button>
      <span>
        {variant} · {VARIANT_NAMES[variant]}
      </span>
      <Button aria-label="Next variant" onClick={next} size="icon-sm" variant="ghost">
        <ArrowRight />
      </Button>
    </fieldset>
  )
}
