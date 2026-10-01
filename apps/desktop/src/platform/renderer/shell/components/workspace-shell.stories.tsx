import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter } from 'react-router'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { AppNavigationRail } from './app-navigation-rail'
import { WorkspaceContentChrome } from './workspace-content-chrome'
import { WorkspaceShell } from './workspace-shell'

const meta = {
  title: 'Workspace/Shell',
  component: WorkspaceShell,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/projects/storybook-project/sessions']}>
        <div className="h-dvh w-full">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof WorkspaceShell>

export default meta
type Story = StoryObj<typeof WorkspaceShell>

const args = {
  rail: <AppNavigationRail />,
  sidebar: <aside aria-label="Workspace sidebar" />,
  header: <div data-component="WorkspaceHeaderFixture" />,
  children: (
    <main aria-label="Workspace content">
      <WorkspaceContentChrome>
        <span data-component="WorkspaceChromeFixture">Workspace controls</span>
      </WorkspaceContentChrome>
    </main>
  ),
}

export const SidebarControls: Story = {
  args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const rail = canvas.getByRole('navigation')
    const header = canvasElement.querySelector<HTMLElement>(
      '[data-component="WorkspaceSidebarHeader"]',
    )
    const railChrome = canvasElement.querySelector<HTMLElement>('[data-component="AppRailChrome"]')
    if (header === null || railChrome === null) throw new Error('The app chrome is absent.')

    expect(rail.getBoundingClientRect().width).toBe(64)
    expect(canvas.getByLabelText('Workspace sidebar').getBoundingClientRect().width).toBe(368)
    expect(rail.getBoundingClientRect().top).toBeCloseTo(header.getBoundingClientRect().bottom, 1)
    expect(railChrome.getBoundingClientRect().bottom).toBeCloseTo(
      header.getBoundingClientRect().bottom,
      1,
    )
    const chromeFixture = canvas.getByText('Workspace controls')
    const content = canvas.getByRole('main', { name: 'Workspace content' })
    expect(chromeFixture.getBoundingClientRect().left).toBeGreaterThanOrEqual(
      content.getBoundingClientRect().left,
    )

    await userEvent.click(canvas.getByRole('button', { name: 'Collapse sidebar' }))
    const opener = await canvas.findByRole('button', { name: 'Open sidebar' })
    await expect(opener).toBeVisible()
    const openerContainer = canvasElement.querySelector(
      '[data-component="WorkspaceCollapsedSidebarControl"]',
    )
    if (openerContainer === null) throw new Error('The collapsed sidebar control is absent.')
    await expect(openerContainer).toHaveClass('no-drag-region')
    expect(chromeFixture.getBoundingClientRect().left).toBeGreaterThanOrEqual(
      opener.getBoundingClientRect().right,
    )
    await userEvent.click(opener)
    await waitFor(() =>
      expect(
        canvas.getByLabelText('Workspace sidebar').getBoundingClientRect().width,
      ).toBeGreaterThan(0),
    )
    await expect(canvas.getByRole('button', { name: 'Collapse sidebar' })).toHaveFocus()
  },
}
