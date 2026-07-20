import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { CommitGroup, type CommitGroupFile } from './CommitGroup'

const FILES: CommitGroupFile[] = [
  {
    kind: 'M',
    path: 'src/auth/rotateToken.ts',
    adds: 12,
    dels: 4,
    hunk: [{ side: 'add', text: '+ assertAudience(claim)' }],
    findings: [],
  },
  {
    kind: 'A',
    path: 'src/auth/assertAudience.ts',
    adds: 8,
    dels: 0,
    hunk: [{ side: 'add', text: '+ export function assertAudience() {}' }],
    findings: [],
  },
]

const meta = {
  title: 'Ship/CommitGroup',
  component: CommitGroup,
  args: { files: FILES, onAdvanceFindingState: fn() },
  argTypes: {
    files: { control: false },
  },
} satisfies Meta<typeof CommitGroup>

export default meta
type Story = StoryObj<typeof meta>

/** A real commit — mono sha, strong message, the file count trailing. Collapsing hides its
 * files without losing the header's own count; expanding brings them back. */
export const Default: Story = {
  args: { commit: { sha: '41ce2f0', message: 'Assert audience on legacy tokens' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('41ce2f0')).toBeInTheDocument()
    await expect(canvas.getByText('Assert audience on legacy tokens')).toBeInTheDocument()
    await expect(canvas.getByText('2 files')).toBeInTheDocument()
    await expect(canvas.getByText('src/auth/rotateToken.ts')).toBeInTheDocument()
    const header = canvas.getByRole('button', { name: /Assert audience/ })
    await userEvent.click(header)
    await expect(canvas.queryByText('src/auth/rotateToken.ts')).not.toBeInTheDocument()
    await expect(canvas.getByText('2 files')).toBeInTheDocument()
    await userEvent.click(header)
    await expect(canvas.getByText('src/auth/rotateToken.ts')).toBeInTheDocument()
  },
}

/** `commit: null` — the WIP group, amber "Uncommitted changes" header. */
export const Uncommitted: Story = {
  args: { commit: null },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Uncommitted changes')).toBeInTheDocument()
  },
}
