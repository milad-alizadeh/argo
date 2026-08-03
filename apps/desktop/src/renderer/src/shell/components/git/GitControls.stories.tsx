import type { BranchRef, GitFacts } from '@shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { branchMenuRows } from '../../branchMenuModel'
import { GitControls } from './GitControls'

function ref(name: string, over: Partial<BranchRef> = {}): BranchRef {
  return { name, remote: false, ahead: 0, behind: 0, worktreePath: null, ...over }
}

const facts: GitFacts = {
  branch: 'main',
  ahead: 2,
  behind: 0,
  branches: [ref('main', { ahead: 2 }), ref('fix/ci-flake'), ref('origin/main', { remote: true })],
}

const meta = {
  title: 'Shell/GitControls',
  component: GitControls,
  args: {
    facts,
    rows: branchMenuRows(facts, new Map()),
    onCheckout: fn(),
    onOperation: fn(),
    onOpenSession: fn(),
    onOpenScratchTerminal: fn(),
    onResolveWithAgent: fn(),
  },
  argTypes: { facts: { control: false }, rows: { control: false } },
} satisfies Meta<typeof GitControls>

export default meta
type Story = StoryObj<typeof meta>

/** The two-button group as the chrome carries it in all three rooms: the selector opens the
 * branch list, the manage trigger opens the safe-sync menu. Both menus close when the other
 * opens, which is what the shared group affords. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByText('main'))
    const menu = within(document.body)
    await expect(await menu.findByText('Files follow this')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await userEvent.click(await canvas.findByRole('button', { name: 'Manage this branch' }))
    await expect(await menu.findByRole('menuitem', { name: 'Push' })).toBeInTheDocument()
  },
}

/** A project folder that is not a git repository: the group is hidden whole rather than showing
 * an empty branch, because a branch control with no checkout behind it is a lie. */
export const NotAGitRepository: Story = {
  args: { facts: null, rows: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button')).not.toBeInTheDocument()
  },
}
