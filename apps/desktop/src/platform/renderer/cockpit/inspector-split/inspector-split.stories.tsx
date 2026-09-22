import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { InspectorSplit } from '@/platform/renderer/cockpit/inspector-split/inspector-split'

// Reuses the Ticket inspector's tokens; the split itself does not own a size family.
const SIZES = {
  inspector: '--size-ticket-inspector',
  inspectorMin: '--size-ticket-inspector-min',
  workspaceMin: '--size-ticket-workspace-min',
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
    workspace: <section aria-label="Workspace" className="h-full" />,
    inspector: <section aria-label="Panel contents" className="h-full" />,
  },
} satisfies Meta<typeof InspectorSplit>

export default meta
type Story = StoryObj<typeof InspectorSplit>

export const CollapseExpandRestore: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Collapsing and reopening swaps the control in the same slot.
    const collapseControl = canvas.getByRole('button', { name: 'Collapse Panel inspector' })
    const collapseLeft = collapseControl.getBoundingClientRect().left
    await userEvent.click(collapseControl)
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Open Panel inspector' })).toBeInTheDocument(),
    )
    await expect(canvas.getByLabelText('Panel contents')).not.toBeVisible()
    const openControl = canvas.getByRole('button', { name: 'Open Panel inspector' })
    await expect(openControl.getBoundingClientRect().left).toBe(collapseLeft)
    await userEvent.click(openControl)
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Collapse Panel inspector' })).toBeInTheDocument(),
    )
    await expect(canvas.getByLabelText('Panel contents')).toBeVisible()
    expect(
      canvas.getByLabelText('Panel contents').getBoundingClientRect().width,
    ).toBeGreaterThanOrEqual(440)

    // Expanding and restoring does the same, one slot to the left of collapse.
    const expandControl = canvas.getByRole('button', { name: 'Expand Panel sidebar' })
    const expandLeft = expandControl.getBoundingClientRect().left
    await userEvent.click(expandControl)
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Restore Panel sidebar' })).toBeInTheDocument(),
    )
    const restoreControl = canvas.getByRole('button', { name: 'Restore Panel sidebar' })
    await expect(restoreControl.getBoundingClientRect().left).toBe(expandLeft)
    await expect(canvas.getByLabelText('Workspace')).toBeVisible()

    await userEvent.click(restoreControl)
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Expand Panel sidebar' })).toBeInTheDocument(),
    )
  },
}
