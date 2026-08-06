import type { GitFacts } from '@shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { CockpitScreenView } from '@/CockpitScreenView'
import { branchMenuRows, type ShellModel } from '@/shell/components'

const FACTS: GitFacts = {
  branch: 'main',
  ahead: 2,
  behind: 1,
  branches: [{ name: 'main', remote: false, ahead: 2, behind: 1, worktreePath: null }],
}

const CONNECTED: ShellModel = {
  connected: true,
  tabs: [
    { id: 'argo', name: 'argo', initial: 'A', active: true, dot: null, lastSynced: '4m ago' },
    {
      id: 'deckhand',
      name: 'deckhand',
      initial: 'D',
      active: false,
      dot: 'amber',
      lastSynced: null,
    },
  ],
}

const meta = {
  title: 'Shell/CockpitScreen',
  component: CockpitScreenView,
  args: {
    shell: CONNECTED,
    room: 'sessions',
    caption: null,
    git: {
      facts: FACTS,
      rows: branchMenuRows(FACTS, new Map()),
      onCheckout: fn(),
      onOperation: fn(),
      onDelete: fn(),
      onOpenSession: fn(),
      onOpenScratchTerminal: fn(),
      onResolveWithAgent: fn(),
    },
    connect: null,
    connectHandlers: {
      onContinue: fn(),
      onRowAct: fn(),
      onChooseCli: fn(),
      onCommit: fn(),
      onContinueOffline: fn(),
    },
    handlers: {
      onSelectProject: fn(),
      onAddProject: fn(),
      onSelectRoom: fn(),
      onConnect: fn(),
      onOpenSettings: fn(),
    },
    children: null,
  },
  argTypes: { room: { control: 'select', options: ['sessions', 'work', 'code'] } },
} satisfies Meta<typeof CockpitScreenView>

export default meta
type Story = StoryObj<typeof meta>

/** What composition creates and no child can show: the strip beside the bar, both floating on the
 * scene, with the room's stage running the full height underneath the bar rather than pushed
 * below it. */
export const Default: Story = {
  args: { children: <div className="flex-1" /> },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('navigation', { name: 'Projects' })).toBeVisible()
    await expect(canvas.getByRole('navigation', { name: 'Rooms' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Manage this branch' })).toBeVisible()
  },
}

/** Nothing connected: the strip is only `+` and the stage hosts the connect seam in place of the
 * room, because the shell renders honestly empty rather than faking content. */
export const NothingConnected: Story = {
  args: { shell: { connected: false, tabs: [] } },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('button', { name: 'argo' })).not.toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Connect a provider' }))
    await expect(args.handlers.onConnect).toHaveBeenCalled()
  },
}

/** A project whose folder is not a git repository: the git group hides WHOLE. An empty branch
 * label would be a control claiming a checkout that does not exist. */
export const NotAGitRepository: Story = {
  args: { git: { ...meta.args.git, facts: null, rows: [] } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).queryByRole('button', { name: 'Manage this branch' }),
    ).not.toBeInTheDocument()
  },
}
