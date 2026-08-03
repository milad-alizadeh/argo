import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import type { ProjectTabView } from '../../shellModel'
import { ProjectStrip } from './ProjectStrip'

const TABS: ProjectTabView[] = [
  { id: 'argo', name: 'argo', initial: 'A', active: true, dot: null },
  { id: 'dashboard', name: 'dashboard', initial: 'D', active: false, dot: 'amber' },
  { id: 'marketing-site', name: 'marketing-site', initial: 'M', active: false, dot: 'run' },
  { id: 'payments', name: 'payments', initial: 'P', active: false, dot: null },
]

const meta = {
  title: 'Shell/ProjectStrip',
  component: ProjectStrip,
  args: {
    tabs: TABS,
    lastSynced: '4m ago',
    onSelectProject: fn(),
    onAddProject: fn(),
    onOpenProjectMenu: fn(),
  },
  argTypes: {
    tabs: { control: 'object', table: { type: { summary: 'ProjectTabView[]' } } },
  },
} satisfies Meta<typeof ProjectStrip>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Several connected projects — the strip's working shape.
 *
 * What only the strip can show is the roll-up read across projects: the active one stays quiet
 * while the others each carry at most one dot, so a glance down the column answers "is anything
 * asking for me elsewhere?" without opening any of them.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const strip = within(canvasElement).getByRole('navigation', { name: 'Projects' })
    await expect(within(strip).getByRole('button', { name: 'argo' })).toHaveAttribute(
      'aria-current',
      'true',
    )
    for (const tab of TABS) {
      await expect(within(strip).getByRole('button', { name: tab.name })).toBeVisible()
    }
  },
}

/** A single project: the strip carries no dot at all, because the only project there is is the
 * one you are looking at, and the active tab is never dotted. */
export const OneProject: Story = {
  args: { tabs: TABS.slice(0, 1) },
  play: async ({ canvasElement }) => {
    const strip = within(canvasElement).getByRole('navigation', { name: 'Projects' })
    await expect(within(strip).getByRole('button', { name: 'argo' })).toBeVisible()
    await expect(within(strip).queryByRole('img')).not.toBeInTheDocument()
  },
}

/** Nothing connected yet: just `+`. The strip fakes no project, and the stage beside it hosts
 * the connect seam rather than an empty room. */
export const NoProjects: Story = {
  args: { tabs: [] },
  play: async ({ args, canvasElement }) => {
    const strip = within(canvasElement).getByRole('navigation', { name: 'Projects' })
    const add = within(strip).getByRole('button', { name: 'Add a project' })
    await expect(within(strip).getAllByRole('button')).toHaveLength(1)
    await userEvent.click(add)
    await expect(args.onAddProject).toHaveBeenCalled()
  },
}
