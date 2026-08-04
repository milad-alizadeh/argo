import type { DiffHunk } from '@shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { DiffView } from './DiffView'

// This component's own patch, and deliberately not the Activity feed's: the two are separate
// modules, and a story reaching across for a fixture is the boundary break the linter exists to
// catch. Real code rather than `line 1 / line 2` — a placeholder hunk hides the one thing a bounded
// diff is judged on, which is whether the first hunk is enough to see what changed.
const ROTATION_HUNKS: DiffHunk[] = [
  {
    oldStart: 12,
    newStart: 12,
    lines: [
      { side: 'context', text: "import { readKey } from './keys'" },
      { side: 'del', text: 'export function verify(token: string) {' },
      { side: 'del', text: '  const key = readKey()' },
      { side: 'add', text: 'export function verify(token: string, rotation: Rotation) {' },
      { side: 'add', text: '  const key = rotation.current()' },
      { side: 'context', text: '  return decode(token, key)' },
    ],
  },
  {
    oldStart: 40,
    newStart: 42,
    lines: [
      { side: 'context', text: 'export function rotate() {' },
      { side: 'del', text: '  keys.push(nextKey())' },
      { side: 'add', text: '  rotation.push(nextKey())' },
    ],
  },
  {
    oldStart: 78,
    newStart: 80,
    lines: [
      { side: 'context', text: 'export { verify }' },
      { side: 'add', text: 'export { rotate }' },
    ],
  },
]

const meta = {
  title: 'UI/DiffView',
  component: DiffView,
  args: { hunks: ROTATION_HUNKS },
  argTypes: { hunks: { control: false, table: { type: { summary: 'DiffHunk[]' } } } },
  decorators: [
    (Story) => (
      <div className="w-lg bg-panel p-region">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DiffView>

export default meta
type Story = StoryObj<typeof meta>

/** Unbounded — every hunk, which is what a review surface wants. The line number heads each hunk
 * because a patch shown in pieces has to say where its pieces sit. */
export const WholePatch: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/rotation.current/)).toBeInTheDocument()
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument()
  },
}

/** Bounded to one hunk, which is what the Activity feed sets — the bound is the caller's, and it is
 * the whole reason there is one renderer here rather than two. */
export const BoundedToOneHunk: Story = {
  args: { maxHunks: 1 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: /show 2 more hunks/ })).toBeInTheDocument()
    await expect(canvas.queryByText(/export \{ rotate \}/)).not.toBeInTheDocument()
  },
}

/** A patch exactly at the bound has nothing hidden, so it shows no affordance at all — an
 * expander that opens nothing is a control that lies. */
export const AtTheBound: Story = {
  args: { maxHunks: ROTATION_HUNKS.length },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button')).not.toBeInTheDocument()
  },
}

/** The rest, opened in place. Reading the whole change never costs you your position in the feed. */
export const Opened: Story = {
  args: { maxHunks: 1 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /show 2 more hunks/ }))
    await expect(canvas.getByText(/export \{ rotate \}/)).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'show less' })).toBeInTheDocument()
  },
}

/** One hunk left to show, said in the singular. */
export const OneHunkRemaining: Story = { args: { maxHunks: 2 } }

/** A binary file, or a patch this could not read. It says so — an empty block would read as
 * "nothing changed", which is the one thing it does not mean. */
export const NoDiffAvailable: Story = {
  args: { hunks: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('no diff available')).toBeInTheDocument()
  },
}
