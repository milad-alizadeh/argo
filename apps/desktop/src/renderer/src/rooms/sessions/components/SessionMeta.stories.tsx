import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { EXTERNAL, interiorOf, RUNNING, withIntent } from '../__fixtures__/interior'
import { SessionMeta } from './SessionMeta'

const full = withIntent(RUNNING).header

const meta = {
  title: 'Sessions/SessionPlane/SessionHeader/SessionMeta',
  component: SessionMeta,
  args: {
    status: full.status,
    segments: full.meta,
    intent: full.intent,
    onOpenIntent: fn(),
  },
  argTypes: {
    status: { control: false, table: { type: { summary: 'SessionDot' } } },
    segments: { control: false, table: { type: { summary: 'MetaSegment[]' } } },
    intent: { control: false, table: { type: { summary: 'IntentChip | null' } } },
  },
} satisfies Meta<typeof SessionMeta>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The whole line — the status dot, then `mode · branch(+counts) · elapsed`, then the intent link.
 *
 * The status word and the model are deliberately NOT here: the roster rail beside this plane already
 * carries both, so the line spends its width on what the rail does not say. This story is where that
 * reading is judged.
 */
export const Full: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    // The branch keeps its NAME as well as its counts: what changed is change against a branch, and a
    // session whose branch the header will not say is a session you cannot place.
    for (const text of ['Code', 'feat/auth-rotation']) {
      await expect(canvas.getByText(text)).toBeInTheDocument()
    }
    // The two facts the rail owns are shed here, not restyled — their absence is the design.
    for (const shed of ['running', 'claude-opus-5']) {
      await expect(canvas.queryByText(shed)).not.toBeInTheDocument()
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
  args: {
    status: interiorOf(EXTERNAL).header.status,
    segments: interiorOf(EXTERNAL).header.meta,
    intent: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('unknown')).toBeInTheDocument()
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument()
  },
}
