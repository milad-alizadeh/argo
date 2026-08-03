import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { TooltipProvider } from '@/shared/components/ui'
import type { RosterTone } from '@/shared/status'
import type { ProjectTabView } from '../../shellModel'
import { ProjectTab } from './ProjectTab'

// The only dots the strip can carry: `worstStateDot` ranks needs-you over failed over running
// and emits nothing for anything else, so these four are the whole union a tab ever sees.
const STRIP_DOTS: readonly (RosterTone | null)[] = ['amber', 'red', 'run', null]

const inactive = (dot: RosterTone | null): ProjectTabView => ({
  id: `dashboard-${dot ?? 'quiet'}`,
  name: 'dashboard',
  initial: 'D',
  active: false,
  dot,
  lastSynced: null,
})

const meta = {
  title: 'Shell/ProjectStrip/ProjectTab',
  component: ProjectTab,
  args: { onSelect: fn() },
  argTypes: {
    tab: { control: 'object', table: { type: { summary: 'ProjectTabView' } } },
  },
  decorators: [
    (Story) => (
      <TooltipProvider>
        <Story />
      </TooltipProvider>
    ),
  ],
} satisfies Meta<typeof ProjectTab>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The project you are looking at: brighter, a concealed cove rail on its left edge, and no dot
 * — its sessions are one glance away in the roster, so a badge here would be a second telling.
 *
 * Hovering it is the only way to see the project's name and when it last synced; the bar carries
 * neither.
 */
export const Active: Story = {
  args: {
    tab: {
      id: 'argo',
      name: 'argo',
      initial: 'A',
      active: true,
      dot: null,
      lastSynced: '4m ago',
    },
  },
  play: async ({ canvasElement }) => {
    await userEvent.hover(within(canvasElement).getByRole('button', { name: 'argo' }))
    const tooltip = await within(document.body).findByRole('tooltip')
    await expect(tooltip).toHaveTextContent('argo')
    await expect(tooltip).toHaveTextContent('last synced 4m ago')
  },
}

/** A project whose `last synced` has never been established. The name still shows, because the
 * tooltip is the only place it appears at all; the missing fact is simply absent. */
export const NeverSynced: Story = {
  args: {
    tab: { id: 'argo', name: 'argo', initial: 'A', active: true, dot: null, lastSynced: null },
  },
  play: async ({ canvasElement }) => {
    await userEvent.hover(within(canvasElement).getByRole('button', { name: 'argo' }))
    const tooltip = await within(document.body).findByRole('tooltip')
    await expect(tooltip).toHaveTextContent('argo')
    await expect(tooltip).not.toHaveTextContent('last synced')
  },
}

/** A project you are not looking at: quieter, and carrying the one worst state its sessions
 * reached. It reveals nothing on hover — name and sync age belong to the active tab. */
export const Inactive: Story = {
  args: { tab: inactive('amber') },
  play: async ({ canvasElement }) => {
    const tab = within(canvasElement).getByRole('button', { name: 'dashboard' })
    await expect(tab).not.toHaveAttribute('aria-current')
    await userEvent.hover(tab)
    await expect(within(document.body).queryByRole('tooltip')).not.toBeInTheDocument()
  },
}

/** Every dot an inactive tab can carry, one tab each — the visual-diff surface for the tone the
 * strip rolls a project's sessions up to. */
export const EveryDot: Story = {
  args: { tab: inactive('amber') },
  render: (args) => (
    <div className="flex gap-region">
      {STRIP_DOTS.map((dot) => (
        <ProjectTab {...args} key={dot ?? 'quiet'} tab={inactive(dot)} />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole('button')).toHaveLength(STRIP_DOTS.length)
  },
}
