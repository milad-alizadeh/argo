import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import type { SessionPlan } from '@/domains/sessions/contract/model/models'
import { ComposerStory } from '@/domains/sessions/renderer/composer/composer-story-samples'
import { useComposerStore } from '@/domains/sessions/renderer/composer/use-composer-store'

const FRAME = 'mx-auto max-w-4xl p-8'

const plan: SessionPlan = {
  state: 'available' as const,
  entries: [{ content: 'Choose the base layout', position: 0, status: 'in_progress' as const }],
}

const meta = {
  title: 'Sessions/Composer/Layout',
  component: ComposerStory,
  decorators: [
    (Story, { parameters }) => (
      <div className={(parameters.frame as string | undefined) ?? FRAME}>
        <Story />
      </div>
    ),
  ],
  // Drafts outlive a story like they outlive a page, so each story starts from none.
  beforeEach: () => {
    useComposerStore.setState(useComposerStore.getInitialState())
  },
} satisfies Meta<typeof ComposerStory>

export default meta
type Story = StoryObj<typeof ComposerStory>

export const WithPlan: Story = {
  args: { plan },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: 'Open task plan' })

    await userEvent.click(trigger)
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  },
}

export const Narrow: Story = {
  parameters: { frame: 'w-(--size-session-feed-min)' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')
    const composerForm = composer.closest('form')

    if (!composerForm) throw new Error('Session composer form is missing.')
    await userEvent.click(composer)
    await userEvent.type(composer, 'Keep the composer usable at narrow widths.')
    await userEvent.click(canvas.getByRole('button', { name: 'Send message' }))
    await expect(canvas.getByTestId('sent-message')).toHaveTextContent(
      'Keep the composer usable at narrow widths.',
    )
    await expect(composerForm.scrollWidth).toBeLessThanOrEqual(composerForm.clientWidth)
  },
}
