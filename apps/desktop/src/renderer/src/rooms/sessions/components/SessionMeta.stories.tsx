import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { EXTERNAL, interiorOf, RUNNING, withIntent } from '../__fixtures__/interior'
import { SessionMeta } from './SessionMeta'

const full = withIntent(RUNNING).header

const meta = {
  title: 'Sessions/SessionPlane/SessionHeader/SessionMeta',
  component: SessionMeta,
  args: { segments: full.meta, intent: full.intent, onOpenIntent: fn() },
  argTypes: {
    segments: { control: false, table: { type: { summary: 'MetaSegment[]' } } },
    intent: { control: false, table: { type: { summary: 'IntentChip | null' } } },
  },
} satisfies Meta<typeof SessionMeta>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The whole line in its fixed order — `status · model · mode · branch(+∆/↑) · elapsed · intent ↗`.
 * The order is the triage sweep and comes pre-derived, so this story is where the reading is judged
 * rather than where the order is decided.
 */
export const Full: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    for (const text of ['running', 'claude-opus-5', 'Code', '3∆ ↑2']) {
      await expect(canvas.getByText(text)).toBeInTheDocument()
    }
    await userEvent.click(canvas.getByText('intent #42 Auth flow'))
    await expect(args.onOpenIntent).toHaveBeenCalledWith(42)
  },
}

/**
 * A session Argo only observes. The intent chip is gone whole — an external session is read-only, so
 * there is nothing to link — and the segments Argo could not establish say `unknown` instead of
 * being filled in.
 */
export const Observed: Story = {
  args: { segments: interiorOf(EXTERNAL).header.meta, intent: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('unknown')).toBeInTheDocument()
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument()
  },
}
