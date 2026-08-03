import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { GitBranchIcon, Status, Text } from '@/shared/components/ui'
import { ROOMS } from '../../shellModel'
import { TopBar } from './TopBar'

// Stand-ins for the two slots the bar does not own: the connection roll-up (issue 275)
// and the git group. They exist to prove the bar's layout holds around whatever those tickets put there.
const CONNECTION_CHIP = <Status tone="stale" word="Stale · 12m · offline" />

const GIT_CONTROLS = (
  <span className="flex items-center gap-snug rounded-lg bg-well px-inset py-gap">
    <GitBranchIcon className="icon-sm text-primary" />
    <Text variant="code-inline">main</Text>
    <Text variant="meta" className="text-foreground-faint">
      ↑2 ↓1
    </Text>
  </span>
)

const meta = {
  title: 'Shell/TopBar',
  component: TopBar,
  args: {
    room: 'code',
    caption: 'Show me where the room switch is wired.',
    gitControls: GIT_CONTROLS,
    onSelectRoom: fn(),
  },
  argTypes: {
    room: { control: 'select', options: [...ROOMS], table: { type: { summary: 'Room' } } },
    caption: { control: 'text' },
    connectionChip: { control: false },
    gitControls: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="w-full self-start">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TopBar>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The bar in its everyday shape: every binding healthy, so the connection chip renders nothing.
 *
 * What only the composition can show is the reading order the bar was arranged for — condition
 * of the world, then where you are, then what you are on — and that the Concierge sits at the
 * opposite end from all three, clear of the traffic lights.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const bar = within(canvasElement)
    await expect(bar.getByRole('navigation', { name: 'Rooms' })).toBeVisible()
    await expect(bar.getByRole('button', { name: 'Code ⌘3' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(bar.getByText('main')).toBeVisible()
    await expect(bar.queryByText(/Stale/)).not.toBeInTheDocument()
  },
}

/**
 * A binding has gone stale, so the chip wakes up.
 *
 * The claim this story exists to hold: the chip appears at the START of the right-aligned
 * cluster, so it grows into the bar's empty middle and the room tabs and git group do not move.
 * Permanent chrome must not twitch because a silent element woke up.
 */
export const ConnectionStale: Story = {
  args: { connectionChip: CONNECTION_CHIP },
  play: async ({ canvasElement }) => {
    const bar = within(canvasElement)
    await expect(bar.getByText('Stale · 12m · offline')).toBeVisible()
    await expect(bar.getByRole('navigation', { name: 'Rooms' })).toBeVisible()
  },
}

/** A project whose folder is not a git repository: the git group is hidden whole rather than
 * rendering an empty branch, and the rest of the cluster closes up behind it. */
export const NoGitControls: Story = {
  args: { gitControls: undefined },
  play: async ({ canvasElement }) => {
    const bar = within(canvasElement)
    await expect(bar.queryByText('main')).not.toBeInTheDocument()
    await expect(bar.getByRole('navigation', { name: 'Rooms' })).toBeVisible()
  },
}

/** A caption long enough to fight the right cluster for the bar's width. It has to give way
 * here, not there: the caption truncates and the cluster keeps every pixel it needs. */
export const LongCaption: Story = {
  args: {
    caption:
      'I looked through the room switch, the keymap and the two prototypes that disagree about where the git group belongs, and here is what I found.',
    connectionChip: CONNECTION_CHIP,
  },
  play: async ({ canvasElement }) => {
    const bar = within(canvasElement)
    await expect(bar.getByRole('button', { name: 'Code ⌘3' })).toBeVisible()
    await expect(bar.getByText('main')).toBeVisible()
  },
}
