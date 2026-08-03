import type { GitFacts } from '@shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { manageMenu } from '../../branchMenuModel'
import { BranchManage } from './BranchManage'

function facts(over: Partial<GitFacts> = {}): GitFacts {
  return { branch: 'main', ahead: 0, behind: 0, branches: [], ...over }
}

// The menu is the component's own, so every story opens it the way a user does.
async function openMenu(canvasElement: HTMLElement): Promise<ReturnType<typeof within>> {
  await userEvent.click(within(canvasElement).getByRole('button'))
  return within(document.body)
}

const meta = {
  title: 'Shell/GitControls/BranchManage',
  component: BranchManage,
  args: {
    menu: manageMenu(facts()),
    onOperation: fn(),
    onOpenScratchTerminal: fn(),
    onResolveWithAgent: fn(),
  },
  argTypes: { menu: { control: false } },
} satisfies Meta<typeof BranchManage>

export default meta
type Story = StoryObj<typeof meta>

/** A branch in step with origin. `Fetch` is offered because it cannot lose work; `Pull` and
 * `Push` are absent because there is nothing to fast-forward or send. Nothing here merges,
 * rebases, forces, or removes a worktree — this menu holds no operation that can lose work, and
 * no `Delete` either: it speaks for the checked-out branch, which git refuses to delete. */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const menu = await openMenu(canvasElement)
    await expect(await menu.findByRole('menuitem', { name: 'Fetch' })).toBeInTheDocument()
    await expect(menu.queryByRole('menuitem', { name: 'Pull' })).not.toBeInTheDocument()
    await expect(menu.queryByRole('menuitem', { name: 'Push' })).not.toBeInTheDocument()
    await expect(menu.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument()
    await userEvent.click(menu.getByRole('menuitem', { name: 'Fetch' }))
    await expect(args.onOperation).toHaveBeenCalledWith('fetch')
  },
}

/** Only behind: a pull would fast-forward, so it is offered. */
export const Behind: Story = {
  args: { menu: manageMenu(facts({ behind: 1 })) },
  play: async ({ canvasElement }) => {
    const menu = await openMenu(canvasElement)
    await expect(await menu.findByRole('menuitem', { name: 'Pull' })).toBeInTheDocument()
    await expect(menu.queryByRole('menuitem', { name: 'Push' })).not.toBeInTheDocument()
  },
}

/** Only ahead: the remote will take a push, so it is offered and the pull is not. */
export const Ahead: Story = {
  args: { menu: manageMenu(facts({ ahead: 2 })) },
  play: async ({ canvasElement }) => {
    const menu = await openMenu(canvasElement)
    await expect(await menu.findByRole('menuitem', { name: 'Push' })).toBeInTheDocument()
    await expect(menu.queryByRole('menuitem', { name: 'Pull' })).not.toBeInTheDocument()
  },
}

/** Ahead *and* behind: neither `Pull` nor `Push` is safe, so `ConflictHatch` takes their place.
 * `Fetch` survives — fetching cannot lose work whatever the branch has done — and branch CRUD is
 * unaffected, because a divergence does not stop you branching. */
export const Diverged: Story = {
  args: { menu: manageMenu(facts({ ahead: 2, behind: 1 })) },
  play: async ({ canvasElement }) => {
    const menu = await openMenu(canvasElement)
    await expect(
      await menu.findByText('Diverged from origin. A pull will conflict.'),
    ).toBeInTheDocument()
    await expect(menu.getByRole('menuitem', { name: 'Fetch' })).toBeInTheDocument()
    await expect(menu.queryByRole('menuitem', { name: 'Pull' })).not.toBeInTheDocument()
    await expect(menu.queryByRole('menuitem', { name: 'Push' })).not.toBeInTheDocument()
    await expect(menu.getByRole('menuitem', { name: 'New branch' })).toBeInTheDocument()
  },
}
