import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import type { DiffFinding, DiffHunkLine, FileChangeKind } from './diffModel'
import { FileDiff } from './FileDiff'

const KINDS: FileChangeKind[] = ['M', 'A', 'D', 'R']

const HUNK: DiffHunkLine[] = [
  { side: 'context', text: '  const claim = token.audience' },
  { side: 'del', text: '- if (legacy) return claim' },
  { side: 'add', text: '+ if (legacy) return assertAudience(claim)' },
]

const FINDINGS: DiffFinding[] = [
  {
    id: 'f1',
    severity: 'blocking',
    state: 'open',
    line: 118,
    body: 'The legacy path drops the audience claim when it falls back to the old token format.',
    by: 'argo · code-review',
  },
]

const meta = {
  title: 'Ship/FileDiff',
  component: FileDiff,
  args: {
    kind: 'M',
    path: 'src/auth/rotateToken.ts',
    adds: 12,
    dels: 4,
    hunk: HUNK,
    findings: [],
    onAdvanceFindingState: fn(),
  },
  argTypes: {
    kind: { control: 'select', options: KINDS },
    markUncommitted: { control: 'boolean' },
    defaultViewed: { control: 'boolean' },
    adds: { control: 'number' },
    dels: { control: 'number' },
    path: { control: 'text' },
    findings: { control: false },
    hunk: { control: false },
  },
} satisfies Meta<typeof FileDiff>

export default meta
type Story = StoryObj<typeof meta>

/** A modified file, unviewed — the hunk is visible and the row reads at full opacity. Marking
 * Viewed (from either the header or the checkbox, one local state) dims the row, strikes the
 * path and collapses the hunk; toggling back restores it. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('src/auth/rotateToken.ts')).toBeInTheDocument()
    await expect(canvas.getByText('+12')).toBeInTheDocument()
    await expect(canvas.getByText('−4')).toBeInTheDocument()
    const checkbox = canvas.getByRole('checkbox', { name: 'Viewed' })
    await expect(checkbox).not.toBeChecked()
    await userEvent.click(canvas.getByText('src/auth/rotateToken.ts'))
    await expect(checkbox).toBeChecked()
    await expect(canvas.queryByText(/const claim/)).not.toBeInTheDocument()
    await userEvent.click(checkbox)
    await expect(checkbox).not.toBeChecked()
    await expect(canvas.getByText(/const claim/)).toBeInTheDocument()
  },
}

/** Starts already Viewed — the uncontrolled default a caller seeds from persisted state. */
export const DefaultViewed: Story = {
  args: { defaultViewed: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('checkbox', { name: 'Viewed' })).toBeChecked()
  },
}

/** The All-files view marks a dirty file; the By-commit view's WIP group header already
 * says so, so it never sets this. */
export const MarkedUncommitted: Story = {
  args: { markUncommitted: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('uncommitted')).toBeInTheDocument()
  },
}

/** A review finding renders inline under the hunk (R14) — the flag count in the header
 * echoes the open count, not the raw total. */
export const WithFinding: Story = {
  args: { findings: FINDINGS },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('1')).toBeInTheDocument()
    await expect(canvas.getByText('blocking')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Address' }))
  },
}

/** Every file kind, one row each — the visual-diff surface for the kind glyph. */
export const AllKinds: Story = {
  render: (args) => (
    <div className="flex flex-col gap-gap">
      {KINDS.map((kind) => (
        <FileDiff key={kind} {...args} kind={kind} path={`${kind}/example.ts`} />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole('checkbox')).toHaveLength(KINDS.length)
  },
}
