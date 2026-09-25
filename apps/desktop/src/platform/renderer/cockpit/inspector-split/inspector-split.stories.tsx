import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { InspectorHeaderControls, InspectorSplit } from './inspector-split'

// Reuses the Ticket inspector's tokens; the split itself does not own a size family.
const SIZES = {
  inspector: '--size-ticket-inspector',
  inspectorMin: '--size-ticket-inspector-min',
  workspaceMin: '--size-ticket-workspace-min',
}

function InspectorSplitWorkspace() {
  return (
    <section aria-label="Workspace" className="flex h-full flex-col">
      <header className="flex h-(--size-chrome-bar) shrink-0 items-center justify-end gap-(--spacing-shell-tight) px-(--spacing-shell-gutter)">
        <InspectorHeaderControls />
      </header>
    </section>
  )
}

const meta = {
  title: 'Components/Inspector Split',
  component: InspectorSplit,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="h-dvh w-full">
        <Story />
      </div>
    ),
  ],
  args: {
    noun: 'Panel',
    sizes: SIZES,
    workspace: <InspectorSplitWorkspace />,
    inspector: <section aria-label="Panel contents" className="h-full" />,
  },
} satisfies Meta<typeof InspectorSplit>

export default meta
type Story = StoryObj<typeof InspectorSplit>

export const CollapseExpandRestore: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // The page's header owns the controls, so a collapsed inspector opens from its header edge.
    const collapseControl = canvas.getByRole('button', { name: 'Collapse Panel inspector' })
    await userEvent.click(collapseControl)
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Open Panel inspector' })).toBeInTheDocument(),
    )
    await expect(canvas.getByLabelText('Panel contents')).not.toBeVisible()
    const openControl = canvas.getByRole('button', { name: 'Open Panel inspector' })
    const workspace = canvas.getByLabelText('Workspace')
    await expect(openControl.getBoundingClientRect().right).toBeLessThanOrEqual(
      workspace.getBoundingClientRect().right,
    )
    await userEvent.click(openControl)
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Collapse Panel inspector' })).toBeInTheDocument(),
    )
    await expect(canvas.getByLabelText('Panel contents')).toBeVisible()
    expect(
      canvas.getByLabelText('Panel contents').getBoundingClientRect().width,
    ).toBeGreaterThanOrEqual(440)

    // When the inspector takes the whole width, its own header keeps the restore control reachable.
    const expandControl = canvas.getByRole('button', { name: 'Expand Panel sidebar' })
    await userEvent.click(expandControl)
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Restore Panel sidebar' })).toBeInTheDocument(),
    )
    const restoreControl = canvas.getByRole('button', { name: 'Restore Panel sidebar' })
    await expect(canvas.getByLabelText('Panel inspector').contains(restoreControl)).toBe(true)
    await expect(canvas.getByLabelText('Workspace')).toBeVisible()

    await userEvent.click(restoreControl)
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Expand Panel sidebar' })).toBeInTheDocument(),
    )
  },
}

export const NarrowCollapsed: Story = {
  args: { defaultCollapsed: true },
  decorators: [
    (Story) => (
      <div className="h-dvh w-[calc(var(--size-ticket-inspector-min)+var(--spacing-shell-region)*5)]">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const workspace = canvas.getByLabelText('Workspace')
    await userEvent.click(canvas.getByRole('button', { name: 'Open Panel inspector' }))
    const restore = await canvas.findByRole('button', { name: 'Restore Panel sidebar' })
    const inspector = canvas.getByLabelText('Panel inspector')
    await expect(inspector.contains(restore)).toBe(true)
    await expect(workspace.getBoundingClientRect().width).toBeLessThanOrEqual(1)
    await expect(inspector.getBoundingClientRect().width).toBeGreaterThanOrEqual(599)
  },
}
