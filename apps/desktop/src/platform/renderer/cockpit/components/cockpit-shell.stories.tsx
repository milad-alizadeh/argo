import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { CockpitNavigationRail } from '@/platform/renderer/cockpit/components/cockpit-navigation-rail'
import { CockpitShell } from '@/platform/renderer/cockpit/components/cockpit-shell'

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
  header: <div data-component="CockpitHeaderFixture" />,
  children: <main aria-label="Cockpit content" />,
}

export const SidebarControls: Story = {
  args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const rail = canvas.getByRole('navigation')
    const header = canvasElement.querySelector<HTMLElement>(
      '[data-component="CockpitSidebarHeader"]',
    )
    const railChrome = canvasElement.querySelector<HTMLElement>(
      '[data-component="CockpitRailChrome"]',
    )
    if (header === null || railChrome === null) throw new Error('The cockpit chrome is absent.')

    expect(rail.getBoundingClientRect().width).toBe(64)
    expect(canvas.getByLabelText('Cockpit sidebar').getBoundingClientRect().width).toBe(368)
    expect(rail.getBoundingClientRect().top).toBeCloseTo(header.getBoundingClientRect().bottom, 1)
    expect(railChrome.getBoundingClientRect().bottom).toBeCloseTo(
      header.getBoundingClientRect().bottom,
      1,
    )

    await userEvent.click(canvas.getByRole('button', { name: 'Collapse sidebar' }))
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Open sidebar' })).toBeInTheDocument(),
    )
    await expect(
      canvasElement.querySelector('[data-component="CockpitCollapsedSidebarControl"]')
        ?.childElementCount,
    ).toBe(1)
    await userEvent.click(canvas.getByRole('button', { name: 'Open sidebar' }))
    await expect(canvas.getByLabelText('Cockpit sidebar')).toBeInTheDocument()
  },
}
