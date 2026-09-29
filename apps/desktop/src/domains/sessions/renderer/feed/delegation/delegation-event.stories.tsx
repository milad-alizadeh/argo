// Compact Feed rows cover a live start, reply, and interrupted Subagent run without cards.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { DelegationEvent } from './delegation-event'

type Row = Parameters<typeof DelegationEvent>[0]['row']

const RESPONDED_ROW: Row = {
  shape: 'subagent',
  id: 'review:responded',
  subagentId: 'call-review',
  event: 'responded',
  state: 'completed',
  name: 'spec_review',
  text: 'The specification covers every visible state.',
  durationMs: 157_000,
  tokens: 18_400,
}

const meta = {
  title: 'Sessions/Feed/Delegation',
  component: DelegationEvent,
  parameters: { layout: 'fullscreen' },
  render: (args) => (
    <div className="max-w-(--size-session-column) bg-background p-snug">
      <DelegationEvent {...args} />
    </div>
  ),
} satisfies Meta<typeof DelegationEvent>

export default meta
type Story = StoryObj<typeof DelegationEvent>

const LONG_PROMPT = [
  '## Review the **Feed** specification',
  '',
  ...Array.from(
    { length: 8 },
    (_, index) =>
      `- Check that state ${index + 1} renders its label, its marker and its keyboard focus.`,
  ),
  '',
  'Report every gap at `apps/desktop/src/domains/sessions/renderer/feed/delegation/delegation-event.tsx`.',
].join('\n')

export const Started: Story = {
  args: {
    onOpen: fn(),
    row: {
      ...RESPONDED_ROW,
      event: 'started',
      state: undefined,
      text: undefined,
      prompt: 'Review the specification.',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: /Spec review started/ })).toBeVisible()
    await expect(canvas.getByText('Review the specification.')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Show full prompt' })).toBeNull()
    await expect(canvas.queryByText('The specification covers every visible state.')).toBeNull()
    await expect(canvasElement.querySelector('.bg-card')).toBeNull()
  },
}

export const LongPrompt: Story = {
  args: {
    onOpen: fn(),
    row: {
      ...RESPONDED_ROW,
      event: 'started',
      state: undefined,
      text: undefined,
      prompt: LONG_PROMPT,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole('heading', { name: 'Review the Feed specification' }),
    ).toBeVisible()
    const toggle = canvas.getByRole('button', { name: 'Show full prompt' })
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    const body = canvasElement.querySelector('[data-slot="delegation-body"]')
    const clipped = () =>
      canvas.getByText(/Report every gap/).getBoundingClientRect().top >=
      (body?.getBoundingClientRect().bottom ?? 0)
    await expect(clipped()).toBe(true)
    toggle.focus()
    await userEvent.keyboard('{Enter}')
    await expect(canvas.getByRole('button', { name: 'Show less' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    await expect(clipped()).toBe(false)
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth)
    await userEvent.keyboard(' ')
    await expect(canvas.getByRole('button', { name: 'Show full prompt' })).toBeVisible()
  },
}

export const Messaged: Story = {
  args: {
    row: {
      ...RESPONDED_ROW,
      id: 'review:messaged',
      event: 'messaged',
      state: undefined,
      text: undefined,
      prompt: 'Also check the empty state.',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole('article', { name: 'Spec review received a message' }),
    ).toBeVisible()
    await expect(canvas.getByText('Also check the empty state.')).toBeVisible()
  },
}

export const Responded: Story = {
  args: { onOpen: fn(), row: RESPONDED_ROW },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('The specification covers every visible state.')).toBeVisible()
    await userEvent.click(
      canvas.getByRole('button', { name: /Spec review sent a reply to the main Session/ }),
    )
    await expect(args.onOpen).toHaveBeenCalledTimes(1)
  },
}

export const Stopped: Story = {
  args: { onOpen: fn(), row: { ...RESPONDED_ROW, state: 'interrupted', text: undefined } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: /Spec review stopped/ })).toBeVisible()
    await expect(canvasElement.querySelector('.bg-warn')).not.toBeNull()
  },
}

export const NotClickable: Story = {
  args: { row: RESPONDED_ROW },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('button')).toBeNull()
  },
}
