import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { CockpitNavigationRail } from './CockpitNavigationRail'
import { CockpitShell } from './CockpitShell'

const meta: Meta<typeof CockpitShell> = {
  title: 'Cockpit/Shell',
  component: CockpitShell,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div className="h-dvh w-full">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof CockpitShell>

const args = {
  rail: <CockpitNavigationRail />,
  sidebar: <aside aria-label="Cockpit sidebar" />,
  children: <main aria-label="Cockpit content" />,
}

export const SidebarControls: Story = {
  args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('button', { name: 'Collapse sidebar' }))
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Open sidebar' })).toBeInTheDocument(),
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Open sidebar' }))
    await expect(canvas.getByLabelText('Cockpit sidebar')).toBeInTheDocument()
  },
}
