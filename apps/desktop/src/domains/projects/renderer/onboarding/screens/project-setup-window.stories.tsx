import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import type { ProjectSetupSnapshot } from '@/domains/projects/renderer/onboarding/onboarding-presentation'
import type { AcceptedSetupPlan, SetupPlan } from '../model/setup-plan'
import { ProjectSetupView } from './project-setup-window'

const project = { id: 'project-1', name: 'Example', path: '/workspace/example' }

const defaultPlan = {
  source: {
    projectId: project.id,
    projectRoot: project.path,
    skillRevision: 'skill-1',
    planRevision: 'plan-1',
    fingerprints: { 'AGENTS.md': 'hash-1' },
  },
  inventory: {
    instructions: ['AGENTS.md'],
    manifests: ['package.json'],
    packageManagers: ['bun'],
    workspaces: ['apps/desktop'],
    existingTools: [],
    currentConfiguration: {},
  },
  targets: [
    {
      id: 'target-desktop',
      name: 'desktop',
      path: 'apps/desktop',
      isDefault: true,
      evidence: 'package.json workspace entry',
      packageManager: 'bun',
      commands: { setup: 'bun install', test: 'bun test' },
      dependencies: [],
      risks: [],
    },
  ],
  capabilities: [
    {
      id: 'capability-quality-gates',
      name: 'setup-quality-gates',
      scope: 'repository',
      targetIds: [],
      disposition: 'recommended',
      evidence: 'No biome.jsonc file was found.',
      reason: 'CI expects quality gates.',
      effects: {
        files: ['biome.jsonc'],
        dependencies: [],
        generatedFiles: [],
        machineWide: false,
      },
      consent: { required: true, personalOrMachineWide: false },
      applicationSteps: [
        {
          id: 'step-write-biome',
          description: 'Write biome.jsonc.',
          prerequisiteIds: [],
        },
      ],
    },
  ],
  toolRecommendations: [],
  repositoryActions: [
    {
      id: 'action-write-biome',
      scope: 'repository',
      reason: 'Establish quality gates.',
      evidence: 'No biome.jsonc file was found.',
      fileCategories: ['configuration'],
      prerequisiteIds: [],
    },
  ],
  targetActions: [],
  verification: [
    {
      id: 'verify-desktop-test',
      targetId: 'target-desktop',
      capabilityId: 'capability-quality-gates',
      command: 'bun test',
      prerequisiteIds: ['action-write-biome'],
      expectedResult: 'Tests pass.',
      timeoutSeconds: 120,
      required: true,
    },
  ],
  risks: [],
  handoff: {
    mutationBoundary: 'setup worktree',
    acceptanceState: 'pending-review',
    applicationOrder: [],
  },
} satisfies SetupPlan

function planFixture(overrides: Partial<SetupPlan> = {}): SetupPlan {
  return { ...defaultPlan, ...overrides }
}

function acceptedPlanFixture(source: SetupPlan): AcceptedSetupPlan {
  return {
    sourceRevision: source.source.planRevision,
    projectRoot: source.source.projectRoot,
    fingerprints: source.source.fingerprints,
    targets: source.targets,
    capabilities: source.capabilities.map(
      ({ disposition: _disposition, ...capability }) => capability,
    ),
    toolRecommendations: source.toolRecommendations,
    repositoryActions: source.repositoryActions,
    targetActions: source.targetActions,
    verification: source.verification,
    handoff: source.handoff,
  }
}

const basePlan = planFixture()
const desktopTarget = basePlan.targets.at(0)
if (!desktopTarget) throw new Error('The setup plan story requires a desktop Target fixture.')
const plan = planFixture({
  targets: [
    {
      ...desktopTarget,
      framework: 'Electron + React',
      packageManager: 'bun',
      dependencies: ['electron', 'react'],
      commands: {
        setup: 'bun install',
        run: 'bun run dev',
        build: 'bun run build',
        test: 'bun test',
        componentExplorer: 'bun run storybook',
      },
    },
    {
      id: 'target-site',
      name: 'website',
      path: 'apps/site',
      isDefault: false,
      evidence: 'apps/site/package.json workspace entry',
      packageManager: 'bun',
      framework: 'Vite + React',
      commands: {
        setup: 'bun install',
        run: 'bun run dev',
        build: 'bun run build',
        test: 'bun test',
      },
      dependencies: ['vite', 'react'],
      risks: [],
    },
  ],
  capabilities: [
    ...basePlan.capabilities,
    {
      id: 'capability-agent-skills',
      name: 'Argo agent skills',
      scope: 'repository',
      targetIds: [],
      disposition: 'recommended',
      evidence: 'No shared agent skill bundle is installed.',
      reason: 'Give Claude Code and Codex the same verified Project workflows.',
      effects: {
        files: ['skills-lock.json', '.agents/skills'],
        dependencies: [],
        generatedFiles: [],
        machineWide: false,
      },
      consent: { required: true, personalOrMachineWide: false },
      applicationSteps: [
        {
          id: 'step-install-agent-skills',
          description: 'Install and lock the Project skill bundle.',
          prerequisiteIds: [],
        },
      ],
    },
  ],
  toolRecommendations: [
    {
      id: 'tool-storybook',
      scope: 'target',
      targetIds: ['target-desktop'],
      recommendedChoice: 'Storybook',
      iconUrl: 'https://storybook.js.org/icon.svg',
      packageNames: ['storybook', '@storybook/react-vite'],
      links: ['https://storybook.js.org'],
      alternatives: [],
      reason: 'Review every onboarding state before it reaches the desktop app.',
      dependencyChanges: ['Add Storybook development dependencies'],
      fileEffects: ['Add Storybook configuration'],
      recommendationVersion: '1',
    },
    {
      id: 'tool-playwright',
      scope: 'repository',
      targetIds: [],
      recommendedChoice: 'Playwright',
      iconUrl: 'https://playwright.dev/img/playwright-logo.svg',
      packageNames: ['@playwright/test'],
      links: ['https://playwright.dev'],
      alternatives: [],
      reason: 'Verify the packaged setup flow and its recovery paths.',
      dependencyChanges: ['Add Playwright as a development dependency'],
      fileEffects: ['Add the Project setup E2E flow'],
      recommendationVersion: '1',
    },
  ],
})
const acceptedPlan = acceptedPlanFixture(plan)
const attempt = {
  number: 1,
  planningHarness: 'claude' as const,
  applicationHarness: null,
  planningSessionId: 'planning-session',
  applicationSessionId: null,
}
const base: ProjectSetupSnapshot = {
  projectId: project.id,
  revision: 0,
  screen: 'choosing-method',
  manualSource: '',
  attempt: null,
  questions: [],
  plan: null,
  acceptedPlan: null,
  progress: [],
  finalDiff: null,
  activeEffect: null,
  recoveryMessage: null,
  pendingApproval: null,
}
const snapshot = (change: Partial<ProjectSetupSnapshot>): ProjectSetupSnapshot => ({
  ...base,
  ...change,
})
// A story with no `play` renders one flow state for visual review only; it carries no
// interaction assertion because the assertions already live on the handful of stories below
// that exercise this screen's real interactive paths.
const VIEW_ONLY = ['view-only']

const story = (change: Partial<ProjectSetupSnapshot>, tags?: string[]): Story => ({
  args: { command: fn(async () => undefined), project, snapshot: snapshot(change) },
  ...(tags ? { tags } : {}),
})

const meta = {
  title: 'Projects/Onboarding/Window',
  component: ProjectSetupView,
  decorators: [(Story) => <div className="h-screen">{Story()}</div>],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ProjectSetupView>
export default meta
type Story = StoryObj<typeof ProjectSetupView>

export const ChoosingSetupMethod = story({ screen: 'choosing-method' })
export const ManualSetup = story(
  { screen: 'manual', manualSource: '{\n  "targets": {}\n}' },
  VIEW_ONLY,
)
export const Planning = story(
  {
    screen: 'planning',
    attempt,
    activeEffect: 'planning',
    progress: [
      { stepId: 'inspect-folder', status: 'passed', message: 'Project structure inspected.' },
      { stepId: 'identify-targets', status: 'running', message: 'Finding runnable Targets.' },
    ],
  },
  VIEW_ONLY,
)
export const Questions = story(
  {
    screen: 'questions',
    attempt,
    questions: [
      {
        id: 'workspace-shape',
        prompt: 'Which workspaces should be independent Targets?',
        context: 'Argo found two runnable workspaces.',
        suggestions: ['Desktop app', 'Website', 'Shared packages'],
        recommended: 'Desktop app',
      },
    ],
  },
  VIEW_ONLY,
)
export const TargetsAndTools = story({ screen: 'reviewing-plan', attempt, plan, acceptedPlan })
export const ProjectSetup = story({
  screen: 'customizing-project-setup',
  attempt,
  plan,
  acceptedPlan,
})
export const Applying = story(
  {
    screen: 'applying',
    attempt: {
      ...attempt,
      applicationHarness: 'claude',
      applicationSessionId: 'application-session',
    },
    plan,
    acceptedPlan,
    activeEffect: 'application',
    progress: [{ stepId: 'write-settings', status: 'running', message: 'Writing settings.' }],
  },
  VIEW_ONLY,
)
export const ReviewRequired = story(
  {
    screen: 'review-required',
    attempt,
    plan,
    recoveryMessage: 'application-drift',
    finalDiff:
      'diff --git a/package.json b/package.json\nindex 4ac..0e2 100644\n--- a/package.json\n+++ b/package.json\n@@ -8,3 +8,4 @@\n   "scripts": {\n+    "storybook": "storybook dev -p 6006",\n     "test": "bun test"\n   }\ndiff --git a/apps/desktop/vite.config.ts b/apps/desktop/vite.config.ts\nindex 21a..7cc 100644\n--- a/apps/desktop/vite.config.ts\n+++ b/apps/desktop/vite.config.ts\n@@ -3,2 +3,3 @@\n export default defineConfig({\n+  plugins: [react()],\n })',
  },
  VIEW_ONLY,
)
export const Interrupted = story(
  {
    screen: 'interrupted',
    attempt,
    recoveryMessage: 'restart-interrupted',
  },
  VIEW_ONLY,
)
export const ReviewingChanges = story(
  {
    screen: 'reviewing-diff',
    attempt,
    plan,
    acceptedPlan,
    finalDiff:
      'diff --git a/.argo/settings.json b/.argo/settings.json\n--- a/.argo/settings.json\n+++ b/.argo/settings.json\n@@ -1 +1,8 @@\n-{"targets":{}}\n+{\n+  "targets": {\n+    "desktop": { "path": "apps/desktop", "run": "bun run dev" },\n+    "website": { "path": "apps/site", "run": "bun run dev" }\n+  }\n+}\ndiff --git a/package.json b/package.json\n--- a/package.json\n+++ b/package.json\n@@ -8,3 +8,5 @@\n   "scripts": {\n+    "storybook": "storybook dev -p 6006",\n+    "test:e2e": "playwright test",\n     "test": "bun test"\n   }\ndiff --git a/playwright.config.ts b/playwright.config.ts\nnew file mode 100644\n--- /dev/null\n+++ b/playwright.config.ts\n@@ -0,0 +1,4 @@\n+export default defineConfig({\n+  testDir: "./e2e",\n+  reporter: "list",\n+})',
  },
  VIEW_ONLY,
)
export const Cancelling = story(
  { screen: 'cancelling', attempt, activeEffect: 'planning' },
  VIEW_ONLY,
)
export const RestartingAttempt = story(
  { screen: 'restarting', attempt, activeEffect: 'planning' },
  VIEW_ONLY,
)
export const RestartAttemptFailed = story(
  {
    screen: 'restart-failed',
    attempt,
    recoveryMessage: 'restart-failed',
  },
  VIEW_ONLY,
)
export const CancelFailed = story(
  {
    screen: 'cancel-failed',
    attempt,
    recoveryMessage: 'cancel-failed',
  },
  VIEW_ONLY,
)
export const AwaitingApproval = story({
  screen: 'awaiting-approval',
  attempt,
  activeEffect: 'planning',
  pendingApproval: {
    effect: 'planning',
    permissionId: 'permission-1',
    description: 'Bash {"command":"bun test","description":"Run the Project tests"}',
  },
})
export const Finalizing = story({ screen: 'finalizing', attempt, finalDiff: 'diff' }, VIEW_ONLY)
export const Deferred = story({ screen: 'deferred' }, VIEW_ONLY)
export const Ready = story({ screen: 'ready' }, VIEW_ONLY)

ChoosingSetupMethod.play = async ({ args, canvasElement }) => {
  const canvas = within(canvasElement)
  await expect(canvas.getByRole('radio', { name: 'Set up with an agent' })).toBeChecked()
  await userEvent.click(canvas.getByRole('button', { name: 'Continue' }))
  await expect(args.command).toHaveBeenCalledWith({ type: 'choose-agent', harness: 'claude' })
}

TargetsAndTools.play = async ({ args, canvasElement }) => {
  const canvas = within(canvasElement)
  await expect(canvas.getByText('Storybook')).toBeVisible()
  await expect(canvas.getByText('Electron + React')).toBeVisible()
  await expect(canvas.getByRole('button', { name: /desktop/ })).toHaveAttribute(
    'aria-expanded',
    'true',
  )
  await userEvent.click(canvas.getByRole('button', { name: 'Continue to Project setup' }))
  await expect(args.command).toHaveBeenCalledWith({ type: 'continue-plan-review' })
}

ProjectSetup.play = async ({ args, canvasElement }) => {
  const canvas = within(canvasElement)
  await expect(canvas.getByText('Argo agent skills')).toBeVisible()
  await expect(canvas.getByRole('button', { name: 'Project setup' })).toBeVisible()
  await expect(canvas.getByRole('button', { name: 'Skills and capabilities' })).toHaveAttribute(
    'aria-expanded',
    'true',
  )
  await expect(canvas.getByRole('switch', { name: 'Include Argo agent skills' })).toBeChecked()
  await userEvent.click(canvas.getByRole('button', { name: 'Preview apply and verify' }))
  await expect(args.command).toHaveBeenCalledWith(expect.objectContaining({ type: 'accept-plan' }))
}

AwaitingApproval.play = async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await expect(canvas.getByRole('heading', { name: 'Permission needed' })).toBeVisible()
  await expect(canvas.getByRole('button', { name: 'Deny' })).toBeVisible()
  await expect(canvas.getByRole('button', { name: 'Allow' })).toBeVisible()
}
