import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter, useLocation } from 'react-router'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { i18n } from '@/platform/renderer/i18n/i18n'
import { type OnboardingState, ProjectOnboarding } from './project-onboarding'

const STUB_LANGUAGE = 'zz'
const STUB_PROJECT_SETUP_TITLE = 'STUB Project changes'
const STUB_PROGRESS_LABEL = 'STUB plan prepared'

function ProjectOnboardingStory({
  initialState,
  pauseProgress,
}: {
  initialState?: Partial<OnboardingState>
  pauseProgress?: boolean
}) {
  const location = useLocation()
  return (
    <>
      <ProjectOnboarding initialState={initialState} pauseProgress={pauseProgress} />
      <output className="sr-only" data-testid="onboarding-location">
        {location.pathname}
      </output>
    </>
  )
}

const meta = {
  title: 'Projects/Project onboarding',
  component: ProjectOnboardingStory,
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/projects/new']}>
        <Story />
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof ProjectOnboardingStory>

export default meta
type Story = StoryObj<typeof meta>

function pausedState(initialState: Partial<OnboardingState>): Story {
  return {
    args: { initialState, pauseProgress: true },
    play: async ({ canvasElement }) => expectOnboardingState(canvasElement, initialState.stage),
  }
}

async function expectOnboardingState(
  canvasElement: HTMLElement,
  state: OnboardingState['stage'] | undefined,
) {
  if (!state) throw new Error('A Storybook state must name an onboarding stage.')
  await expect(canvasElement.querySelector('[data-component="ProjectOnboarding"]')).toHaveAttribute(
    'data-state',
    state,
  )
}

export const ManualSetupCompletesInPlace: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /Choose$/ }))
    await userEvent.click(canvas.getByRole('button', { name: /Manual setup/ }))
    await userEvent.click(canvas.getByRole('button', { name: 'Validate JSON' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Preview configuration' }))
    await expect(
      canvas.getByRole('heading', { name: 'Manual configuration preview' }),
    ).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Open Project' })).toBeDisabled()
    await expect(canvas.getByTestId('onboarding-location')).toHaveTextContent('/projects/new')
    await expect(
      canvas.getByRole('heading', { name: 'Manual configuration preview' }),
    ).toBeVisible()
  },
}

export const AgentFlowReachesRecommendations: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /Choose$/ }))
    await expectOnboardingState(canvasElement, 'method')
    await expect(canvas.getByRole('button', { name: 'Analyze Project' })).toBeEnabled()
    await userEvent.click(canvas.getByRole('button', { name: 'Analyze Project' }))
    await expect(canvas.getAllByText('Reading the Project structure')[0]).toBeVisible()
    await expectOnboardingState(canvasElement, 'analyzing')
    await waitFor(() => expectOnboardingState(canvasElement, 'recommendations'), { timeout: 8_000 })
  },
}

export const DefaultHarness = pausedState({ defaultHarness: null, stage: 'no-default' })
export const Harness = pausedState({ stage: 'harness' })
export const Analyzing = pausedState({ method: 'agent', stage: 'analyzing' })
export const Recommendations = pausedState({ method: 'agent', stage: 'recommendations' })
export const PlanNeedsInput = pausedState({
  method: 'agent',
  planOutcome: 'needs-input',
  stage: 'recommendations',
})
export const PlanCannotProceed = pausedState({
  method: 'agent',
  planOutcome: 'cannot-plan',
  stage: 'recommendations',
})
export const PlanIsMalformed = pausedState({
  method: 'agent',
  planOutcome: 'malformed',
  stage: 'recommendations',
})
export const Customize = pausedState({ method: 'agent', stage: 'customize' })
export const ProjectSetup = pausedState({ method: 'agent', stage: 'project-setup' })

export const ProjectSetupUsesLocaleCatalog: Story = {
  args: { initialState: { method: 'agent', stage: 'project-setup' }, pauseProgress: true },
  beforeEach: async () => {
    i18n.addResourceBundle(STUB_LANGUAGE, 'projects', {
      onboarding: { repositoryGroups: { projectFiles: { title: STUB_PROJECT_SETUP_TITLE } } },
    })
    await i18n.changeLanguage(STUB_LANGUAGE)
    return async () => {
      i18n.removeResourceBundle(STUB_LANGUAGE, 'projects')
      await i18n.changeLanguage('en')
    }
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(STUB_PROJECT_SETUP_TITLE)).toBeVisible()
  },
}

export const ProgressUsesActiveLocale: Story = {
  args: { initialState: { method: 'agent', stage: 'project-setup' }, pauseProgress: true },
  beforeEach: async () => {
    i18n.addResourceBundle(STUB_LANGUAGE, 'projects', {
      onboarding: { timeline: { plan: STUB_PROGRESS_LABEL } },
    })
    return async () => {
      i18n.removeResourceBundle(STUB_LANGUAGE, 'projects')
      await i18n.changeLanguage('en')
    }
  },
  play: async ({ canvasElement }) => {
    await i18n.changeLanguage(STUB_LANGUAGE)
    const labels = within(canvasElement).getAllByText(STUB_PROGRESS_LABEL)
    await expect(labels.length).toBeGreaterThan(0)
    await expect(labels.at(-1)).toBeVisible()
  },
}

export const ManualInvalid: Story = {
  args: {
    initialState: { manualSource: '{', method: 'manual', stage: 'manual' },
    pauseProgress: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expectOnboardingState(canvasElement, 'manual')

    const input = canvas.getByRole('textbox', { name: 'Project Target configuration' })
    const error = canvas.getByText(
      'Use a JSON object with a targets object. Target fields must be strings.',
    )
    await expect(input).toHaveAttribute('aria-invalid', 'true')
    await expect(input).toHaveAttribute('aria-describedby', error.id)
    await expect(error).toHaveAttribute('role', 'status')
    await expect(canvas.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  },
}

export const ManualEmpty: Story = {
  args: {
    initialState: { manualSource: '{"targets":{}}', method: 'manual', stage: 'manual' },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Validate JSON' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Preview configuration' }))
    await expectOnboardingState(canvasElement, 'complete')
    await expect(
      canvas.getByRole('heading', { name: 'Manual configuration preview' }),
    ).toBeVisible()
  },
}

export const Applying = pausedState({ applyStep: 0, method: 'agent', stage: 'applying' })
export const WaitingForChoices = pausedState({
  applyStep: 2,
  method: 'agent',
  stage: 'applying',
  waitingTaskId: 'repository-matt-pocock',
})
export const ApplyFailed = pausedState({
  applyStep: 10,
  failureTargetId: 'desktop',
  method: 'agent',
  stage: 'apply-failed',
})
export const Starting = pausedState({ method: 'agent', stage: 'starting' })
export const CompletedRunning = pausedState({ method: 'agent', stage: 'complete' })
export const CompletedManual = pausedState({ method: 'manual', stage: 'complete' })
export const CompletedSkipped = pausedState({ skippedSetup: true, stage: 'complete', targets: [] })
