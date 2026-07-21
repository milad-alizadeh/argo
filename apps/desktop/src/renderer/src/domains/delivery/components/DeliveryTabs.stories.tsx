import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { DeliveryTabs } from './DeliveryTabs'

const meta = {
  title: 'Delivery/DeliveryTabs',
  component: DeliveryTabs,
} satisfies Meta<typeof DeliveryTabs>

export default meta
type Story = StoryObj<typeof meta>

const unscopedArgs = {
  variant: 'unscoped' as const,
  tab: 'changes' as const,
  onSelectTab: fn(),
  changesCount: 12,
  reviewOutstanding: 0,
  artifactsCount: 4,
  changesView: 'all' as const,
  onChangeChangesView: fn(),
}

/** Unscoped, Changes selected — the default landing tab, All files | By commit showing. */
export const Default: Story = {
  args: unscopedArgs,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const changes = canvas.getByRole('tab', { name: /Changes · 12/ })
    await expect(changes).toHaveAttribute('aria-selected', 'true')
    // Clear: a check, never a count.
    await expect(canvas.getByRole('tab', { name: 'Review' })).toBeInTheDocument()
    await expect(canvas.getByRole('radio', { name: 'All files' })).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('tab', { name: /Artifacts · 4/ }))
    await expect(unscopedArgs.onSelectTab).toHaveBeenCalledWith('artifacts')
  },
}

/** By commit selected — the toggle's other position (the segmented control lives inline in
 * the strip now, so this story is its only VRT surface). */
export const UnscopedByCommit: Story = {
  args: { ...unscopedArgs, changesView: 'commits' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('radio', { name: 'By commit' })).toHaveAttribute(
      'data-state',
      'on',
    )
  },
}

/** Outstanding findings — the count plus the static glow dot, the agent review's ONE
 * pointer (R14). The `argo` attribution lives only in the tooltip. */
export const ReviewOutstanding: Story = {
  args: { ...unscopedArgs, tab: 'review', reviewOutstanding: 2 },
  play: async ({ canvasElement }) => {
    const tab = within(canvasElement).getByRole('tab', { name: /Review · 2/ })
    await expect(tab).toHaveAttribute('title', expect.stringContaining('argo'))
    // The Changes view toggle only shows beside the selected Changes tab.
    await expect(within(canvasElement).queryByRole('radio')).not.toBeInTheDocument()
  },
}

/** Selecting the Changes tab hides the toggle again for every other tab. */
export const ArtifactsSelected: Story = {
  args: { ...unscopedArgs, tab: 'artifacts' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('radio')).not.toBeInTheDocument()
  },
}

/** Scoped to an outcome — the return path replaces the three tabs with one static label. */
const onBack = fn()

export const Scoped: Story = {
  args: { variant: 'scoped', outcomeTitle: 'Auth refactor', onBack },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Auth refactor')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: /All changes/ }))
    await expect(onBack).toHaveBeenCalled()
  },
}

/** A non-mocked session: static Changes/Artifacts, nothing wired. */
export const Stub: Story = {
  args: { variant: 'stub' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Changes')).toBeInTheDocument()
    await expect(canvas.getByText('Artifacts')).toBeInTheDocument()
    await expect(canvas.queryByRole('tab')).not.toBeInTheDocument()
  },
}
