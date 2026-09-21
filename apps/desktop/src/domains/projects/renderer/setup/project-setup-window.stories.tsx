import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { acceptedPlanFixture, planFixture } from '@/domains/projects/contract/setup-plan.fixture'
import { ProjectSetupView } from './project-setup-window'

const project = { id: 'project-1', name: 'Example', path: '/workspace/example' }
const choosing = {
  version: 1 as const,
  type: 'project.setup.snapshot' as const,
  requestId: 'story',
  projectId: project.id,
  revision: 0,
  screen: 'choosing-method' as const,
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

const meta: Meta<typeof ProjectSetupView> = {
  title: 'Projects/Project setup',
  component: ProjectSetupView,
  decorators: [(Story) => <div className="h-screen">{Story()}</div>],
}
export default meta
type Story = StoryObj<typeof ProjectSetupView>
const plan = planFixture()
const acceptedPlan = acceptedPlanFixture(plan)
const acceptedForApplication = {
  ...acceptedPlan,
  handoff: { ...acceptedPlan.handoff, acceptanceState: 'accepted' as const },
}

export const Manual: Story = {
  args: { project, snapshot: { ...choosing, screen: 'manual' }, command: async () => undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByRole('textbox', { name: 'Project configuration' }), 'version')
    await expect(canvas.getByRole('button', { name: 'Save manual setup' })).toBeVisible()
  },
}

export const Deferred: Story = {
  args: {
    project,
    snapshot: { ...choosing, screen: 'deferred', revision: 2 },
    command: async () => undefined,
  },
}

export const AgentChoice: Story = {
  args: { project, snapshot: choosing, command: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Plan with Claude' }))
    await expect(args.command).toHaveBeenCalledWith({ type: 'choose-agent', harness: 'claude' })
  },
}

export const Questions: Story = {
  args: {
    project,
    snapshot: {
      ...choosing,
      attempt: {
        number: 1,
        planningHarness: 'claude',
        applicationHarness: null,
        planningSessionId: 'planning-session',
        applicationSessionId: null,
      },
      questions: [{ id: 'package-manager', prompt: 'Which package manager should Argo use?' }],
      revision: 3,
      screen: 'questions',
    },
    command: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByRole('textbox'), 'Bun')
    await userEvent.click(canvas.getByRole('button', { name: 'Continue planning' }))
    await expect(args.command).toHaveBeenCalledWith({
      type: 'answer-questions',
      answers: [{ id: 'package-manager', answer: 'Bun' }],
    })
  },
}

export const PlanReview: Story = {
  args: {
    project,
    snapshot: { ...choosing, attempt: null, plan, revision: 4, screen: 'reviewing-plan' },
    command: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Accept plan' }))
    await expect(args.command).toHaveBeenCalledWith({
      type: 'accept-plan',
      acceptedPlan: acceptedForApplication,
    })
  },
}

export const FinalDiffReview: Story = {
  args: {
    project,
    snapshot: {
      ...choosing,
      finalDiff: 'diff --git a/.argo/settings.json b/.argo/settings.json',
      revision: 5,
      screen: 'reviewing-diff',
    },
    command: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Approve final diff' }))
    await expect(args.command).toHaveBeenCalledWith({ type: 'approve-final-diff' })
  },
}

export const RecoveredFinalization: Story = {
  args: {
    project,
    snapshot: {
      ...choosing,
      finalDiff: 'diff --git a/.argo/settings.json b/.argo/settings.json',
      recoveryMessage:
        'Argo could not confirm that the approved setup worktree was promoted before restart.',
      revision: 6,
      screen: 'reviewing-diff',
    },
    command: fn(),
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(
        'Argo could not confirm that the approved setup worktree was promoted before restart.',
      ),
    ).toBeVisible()
  },
}

export const Applying: Story = {
  args: {
    project,
    snapshot: {
      ...choosing,
      attempt: {
        number: 1,
        planningHarness: 'claude',
        applicationHarness: 'claude',
        planningSessionId: 'planning-session',
        applicationSessionId: 'application-session',
      },
      activeEffect: 'application',
      progress: [{ stepId: 'write-settings', status: 'running', message: 'Writing settings.' }],
      revision: 6,
      screen: 'applying',
    },
    command: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel setup' }))
    await expect(args.command).toHaveBeenCalledWith({ type: 'cancel-setup' })
  },
}

export const Finalizing: Story = {
  args: {
    project,
    snapshot: { ...choosing, finalDiff: 'diff', revision: 7, screen: 'finalizing' },
    command: async () => undefined,
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Working…')).toBeVisible()
  },
}

export const SourceDrift: Story = {
  args: {
    project,
    snapshot: {
      ...choosing,
      recoveryMessage: 'Source changed: package.json',
      revision: 6,
      screen: 'review-required',
    },
    command: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Return to plan review' }))
    await expect(args.command).toHaveBeenCalledWith({
      type: 'request-plan-change',
      feedback: 'Review drift',
    })
  },
}

export const Interrupted: Story = {
  args: {
    project,
    snapshot: {
      ...choosing,
      attempt: {
        number: 1,
        planningHarness: 'claude',
        applicationHarness: null,
        planningSessionId: 'planning-session',
        applicationSessionId: null,
      },
      recoveryMessage: 'The planning effect was interrupted by an application restart.',
      revision: 7,
      screen: 'interrupted',
    },
    command: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Resume setup' }))
    await expect(args.command).toHaveBeenCalledWith({ type: 'resume-planning' })
    await userEvent.click(canvas.getByRole('button', { name: 'Start a new Attempt' }))
    await expect(args.command).toHaveBeenCalledWith({ type: 'restart-attempt' })
  },
}

export const StaleCommand: Story = {
  args: { project, snapshot: { ...choosing, screen: 'manual' }, command: async () => undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Save manual setup' }))
  },
}

export const MultiWindow: Story = {
  args: {
    project,
    snapshot: { ...choosing, screen: 'ready', revision: 3 },
    command: async () => undefined,
  },
}
