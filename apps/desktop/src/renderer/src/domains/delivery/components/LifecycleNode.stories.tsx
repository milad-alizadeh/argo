import type { LifecycleNodeState } from '@shared'
import { LIFECYCLE_KEYS } from '@shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { LifecycleNode } from './LifecycleNode'

// No runtime array of the ten states ships from `@shared` (only the type), so this is the
// gallery's own list — `satisfies` keeps it a compile error for the union to drift from it.
const LIFECYCLE_NODE_STATES = [
  'wait',
  'now',
  'gate',
  'sync',
  'auto',
  'done',
  'fail',
  'warn',
  'stale',
  'lock',
] as const satisfies readonly LifecycleNodeState[]

const meta = {
  title: 'Delivery/LifecycleNode',
  component: LifecycleNode,
  argTypes: {
    nodeKey: { control: 'select', options: LIFECYCLE_KEYS },
    state: { control: 'select', options: LIFECYCLE_NODE_STATES },
    sub: { control: 'text' },
    isHead: { control: 'boolean' },
    open: { control: 'boolean' },
    clickable: { control: 'boolean' },
  },
} satisfies Meta<typeof LifecycleNode>

export default meta
type Story = StoryObj<typeof meta>

/** The everyday shape: an agent owns Commits, so the head node is `now` and silent (R2). */
export const Default: Story = {
  args: { nodeKey: 'commits', state: 'now', isHead: true, open: false, clickable: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Commits')).toBeInTheDocument()
    await expect(canvas.getByRole('button')).toBeInTheDocument()
  },
}

/** `wait` never accepts a click — nothing downstream of the head has anything to show yet. */
export const NotClickable: Story = {
  args: { nodeKey: 'review', state: 'wait', isHead: false, open: false, clickable: false },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button')).not.toBeInTheDocument()
  },
}

/** The node whose drawer is currently open reads with the wash beneath it. */
export const Open: Story = {
  args: { nodeKey: 'ci', state: 'fail', isHead: true, open: true, clickable: true },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[aria-current="true"]')).toBeInTheDocument()
  },
}

/**
 * R2/R10: the head node takes the screen's one pulse, and only while it is `gate`, `fail`
 * or `warn` — stalled on a human. `now` (an agent/CI owns the stage) never pulses.
 */
export const HeadPulsing: Story = {
  args: { nodeKey: 'merge', state: 'gate', isHead: true, open: false, clickable: true },
  play: async ({ canvasElement }) => {
    const glyph = within(canvasElement).getByRole('button').firstElementChild
    await expect(getComputedStyle(glyph as Element).animationName).toBe('pulse-status')
  },
}

/** Every state on one node, in the study's own left-to-right node order. The visual-diff
 * surface for the whole `LifecycleNodeState` palette — including the `now`/`gate`/`sync` glyph
 * the three deliberately share (R2), and gate's outer ring. */
export const EveryState: Story = {
  args: { nodeKey: 'commits', state: 'now', isHead: false, open: false, clickable: true },
  render: () => (
    <div className="flex divide-x divide-inset-hair border border-inset-hair">
      {LIFECYCLE_NODE_STATES.map((state) => (
        <LifecycleNode
          key={state}
          nodeKey="commits"
          state={state}
          isHead={state === 'gate'}
          open={false}
          clickable={state !== 'wait'}
        />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll('[role="button"]')).toHaveLength(
      LIFECYCLE_NODE_STATES.length - 1,
    )
  },
}

/** Every node's own label, done and idle — the axis `state` cannot cover. */
export const EveryNode: Story = {
  args: { nodeKey: 'commits', state: 'done', isHead: false, open: false, clickable: true },
  render: () => (
    <div className="flex divide-x divide-inset-hair border border-inset-hair">
      {LIFECYCLE_KEYS.map((key) => (
        <LifecycleNode key={key} nodeKey={key} state="done" isHead={false} open={false} clickable />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const label of ['Commits', 'PR', 'CI', 'Review', 'Merge']) {
      await expect(canvas.getByText(label)).toBeInTheDocument()
    }
  },
}

/** The sub echo — a count or a sha, never a re-typed state word. */
export const WithSub: Story = {
  args: {
    nodeKey: 'commits',
    state: 'gate',
    sub: '3 dirty',
    isHead: true,
    open: false,
    clickable: true,
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('3 dirty')).toBeInTheDocument()
  },
}
