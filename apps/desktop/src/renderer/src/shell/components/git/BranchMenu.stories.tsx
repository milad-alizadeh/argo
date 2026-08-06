import type { BranchRef, GitFacts } from '@shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { DropdownMenu, DropdownMenuTrigger } from '@/shared/components/ui'
import { branchMenuRows } from '../../git/branchMenuModel'
import { BranchMenu } from './BranchMenu'
import { BranchSelector } from './BranchSelector'

const TOKENS_WORKTREE = '/code/argo/.claude/worktrees/refresh-tokens'
const AUDIT_WORKTREE = '/code/argo/.claude/worktrees/token-audit'

function ref(name: string, over: Partial<BranchRef> = {}): BranchRef {
  return { name, remote: false, ahead: 0, behind: 0, worktreePath: null, ...over }
}

const facts: GitFacts = {
  branch: 'main',
  ahead: 2,
  behind: 1,
  branches: [
    ref('main', { ahead: 2, behind: 1 }),
    ref('feat/refresh-tokens', { worktreePath: TOKENS_WORKTREE }),
    ref('chore/token-audit', { worktreePath: AUDIT_WORKTREE }),
    ref('fix/ci-flake', { ahead: 2 }),
    ref('origin/main', { remote: true, behind: 1 }),
    ref('origin/hotfix-402', { remote: true }),
  ],
}

const localOnlyFacts: GitFacts = {
  ...facts,
  branches: facts.branches.filter((branch) => !branch.remote),
}

// The rows come from the model, never hand-authored: a story that spelled its own actions could
// show a refusal the app does not make.
const rows = branchMenuRows(facts, new Map([[TOKENS_WORKTREE, 'session-7']]))

const meta = {
  title: 'Shell/GitControls/BranchMenu',
  component: BranchMenu,
  args: { rows, onCheckout: fn(), onOpenSession: fn(), onDelete: fn() },
  render: (args) => (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger asChild>
        <BranchSelector branch={facts.branch} ahead={facts.ahead} behind={facts.behind} />
      </DropdownMenuTrigger>
      <BranchMenu {...args} />
    </DropdownMenu>
  ),
} satisfies Meta<typeof BranchMenu>

export default meta
type Story = StoryObj<typeof meta>

/** Every row shape at once: the checked-out branch, a plain local branch, a remote ref offering
 * `Check out`, a worktree-held branch whose live session the `↗` opens, and a worktree that
 * outlived its session and shows its path instead of a dead link. Both worktree rows refuse the
 * checkout — visibly disabled, with `worktree` stated beside the name. */
export const Default: Story = {
  play: async ({ args }) => {
    const menu = within(document.body)
    const held = await menu.findByRole('menuitem', { name: /feat\/refresh-tokens worktree/ })
    const orphaned = menu.getByRole('menuitem', { name: /chore\/token-audit worktree/ })
    await expect(held).toHaveAttribute('aria-disabled', 'true')
    await expect(orphaned).toHaveAttribute('aria-disabled', 'true')
    await expect(orphaned).toHaveTextContent(AUDIT_WORKTREE)
    await expect(menu.getByText('Files follow this')).toBeInTheDocument()
    await expect(menu.getByRole('menuitem', { name: /^main/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    await userEvent.click(
      menu.getByRole('menuitem', { name: 'Open the session working in feat/refresh-tokens' }),
    )
    await expect(args.onOpenSession).toHaveBeenCalledWith('session-7')
  },
}

/** A checkout that has never seen a remote: the `Remote · origin` group is absent rather than
 * empty, an actionable local row checks out through `onCheckout`, and that row is the only kind
 * that also offers a delete — git refuses to delete the branch you are on or one a worktree
 * holds, and deleting a remote ref would lose work that is not yours. */
export const LocalOnly: Story = {
  args: { rows: branchMenuRows(localOnlyFacts, new Map()) },
  play: async ({ args }) => {
    const menu = within(document.body)
    await expect(menu.queryByText('Remote · origin')).not.toBeInTheDocument()
    await expect(
      await menu.findByRole('menuitem', { name: 'Delete fix/ci-flake' }),
    ).toBeInTheDocument()
    await expect(menu.queryByRole('menuitem', { name: 'Delete main' })).not.toBeInTheDocument()
    await userEvent.click(menu.getByRole('menuitem', { name: /^fix\/ci-flake/ }))
    await expect(args.onCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'fix/ci-flake' }),
    )
  },
}
