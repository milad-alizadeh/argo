import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { AllFilesDiff, type AllFilesDiffFile } from './AllFilesDiff'

const FILES: AllFilesDiffFile[] = [
  {
    kind: 'M',
    path: 'src/auth/rotateToken.ts',
    adds: 12,
    dels: 4,
    hunk: [{ side: 'add', text: '+ assertAudience(claim)' }],
    findings: [],
    commit: '41ce2f0',
  },
  {
    kind: 'A',
    path: 'src/auth/assertAudience.ts',
    adds: 8,
    dels: 0,
    hunk: [{ side: 'add', text: '+ export function assertAudience() {}' }],
    findings: [],
    commit: null,
  },
]

const meta = {
  title: 'Ship/AllFilesDiff',
  component: AllFilesDiff,
  args: { onAdvanceFindingState: fn() },
  argTypes: {
    files: { control: false },
  },
} satisfies Meta<typeof AllFilesDiff>

export default meta
type Story = StoryObj<typeof meta>

/** Every changed file flat, dirty files marked — the churn total in the section header. */
export const Default: Story = {
  args: { files: FILES },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('vs merge-base')).toBeInTheDocument()
    await expect(canvas.getByText('· +20 −4 · uncommitted included')).toBeInTheDocument()
    await expect(canvas.getByText('src/auth/rotateToken.ts')).toBeInTheDocument()
    // Committed file: no badge. Dirty file: the wip badge.
    await expect(canvas.getByText('uncommitted')).toBeInTheDocument()
    await expect(canvas.getAllByText('uncommitted')).toHaveLength(1)
  },
}

/** No changes yet — the real state a clean tree with an open ribbon can still show. */
export const Empty: Story = {
  args: { files: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('No changes yet.')).toBeInTheDocument()
  },
}
