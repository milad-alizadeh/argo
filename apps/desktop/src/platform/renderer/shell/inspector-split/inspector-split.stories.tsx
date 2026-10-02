import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { AppPageHeader } from '../../app/components/app-shell'
import { InspectorHeaderControls, InspectorSplit } from './inspector-split'

// Reuses the Ticket inspector's tokens; the split itself does not own a size family.
const SIZES = {
  inspector: '--size-ticket-inspector',
  inspectorMin: '--size-ticket-inspector-min',
  workspaceMin: '--size-ticket-workspace-min',
}

function InspectorSplitWorkspace() {
  return (
    <section aria-label="Workspace" className="panel-stack">
      <AppPageHeader>
        <InspectorHeaderControls />
      </AppPageHeader>
      <div className="panel-content" />
    </section>
  )
}

const meta = {
  title: 'Design System/Patterns/Inspector Split',
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
    await expect(canvas.getByLabelText('Panel inspector').contains(collapseControl)).toBe(true)
    await userEvent.click(collapseControl)
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Open Panel inspector' })).toBeInTheDocument(),
    )
    await waitFor(() => expect(canvas.getByLabelText('Panel contents')).not.toBeVisible())
    const openControl = canvas.getByRole('button', { name: 'Open Panel inspector' })
    await userEvent.click(openControl)
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Collapse Panel inspector' })).toBeInTheDocument(),
    )
    await waitFor(() => expect(canvas.getByLabelText('Panel contents')).toBeVisible())
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Collapse Panel inspector' })).toHaveFocus(),
    )

    // When the inspector takes the whole width, its own header keeps the restore control reachable.
    const expandControl = canvas.getByRole('button', { name: 'Expand Panel sidebar' })
    await userEvent.click(expandControl)
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Restore Panel sidebar' })).toBeInTheDocument(),
    )
    const restoreControl = canvas.getByRole('button', { name: 'Restore Panel sidebar' })
    await expect(canvas.getByLabelText('Panel inspector').contains(restoreControl)).toBe(true)
    await waitFor(() => expect(canvas.getByLabelText('Workspace')).not.toBeVisible())

    await userEvent.click(restoreControl)
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Expand Panel sidebar' })).toBeInTheDocument(),
    )
  },
}

export const NarrowCollapsed: Story = {
  args: { defaultCollapsed: true },
  globals: { viewport: { value: 'compact', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Open Panel inspector' }))
    const restore = await canvas.findByRole('button', { name: 'Restore Panel sidebar' })
    const inspector = canvas.getByLabelText('Panel inspector')
    await expect(inspector.contains(restore)).toBe(true)
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Collapse Panel inspector' })).toHaveFocus(),
    )
  },
}
