import type { RibbonModel } from '@shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { PrLifecycleRibbon } from './PrLifecycleRibbon'

const IN_REVIEW: RibbonModel = {
  nodes: { commits: 'done', pr: 'done', ci: 'done', review: 'now', merge: 'wait' },
  head: 'review',
  terminal: null,
}

type PrLifecycleRibbonProps = React.ComponentProps<typeof PrLifecycleRibbon>

const PR: PrLifecycleRibbonProps['pr'] = {
  num: 42,
  ghUrl: 'https://github.com/milad-alizadeh/argo/pull/42',
}

const meta = {
  title: 'Cockpit/PrLifecycleRibbon',
  component: PrLifecycleRibbon,
  argTypes: {
    model: { control: false },
    openKey: { control: false },
    pr: { control: false },
  },
} satisfies Meta<typeof PrLifecycleRibbon>

export default meta
type Story = StoryObj<typeof meta>

/** The everyday five-node strip, PR anchor included once one exists (R9). */
export const Default: Story = {
  args: { model: IN_REVIEW, openKey: 'review', pr: PR },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Review')).toBeInTheDocument()
    await expect(canvas.getByText('PR #42')).toBeInTheDocument()
  },
}

/** Pre-PR: nothing dispatches yet, so the anchor has nothing to name (R9 — it exists only
 * once a PR does). */
export const BeforePr: Story = {
  args: {
    model: {
      nodes: { commits: 'done', pr: 'gate', ci: 'wait', review: 'wait', merge: 'wait' },
      head: 'pr',
      terminal: null,
    },
    openKey: 'pr',
    pr: null,
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByText(/PR #/)).not.toBeInTheDocument()
  },
}

/** R8: merged replaces the whole strip with a terminal card — landed, not CI-pass green. */
export const Merged: Story = {
  args: { model: { nodes: null, head: null, terminal: 'merged' }, openKey: null, pr: PR },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Merged')).toBeInTheDocument()
    await expect(canvas.queryByText('Commits')).not.toBeInTheDocument()
  },
}

/** R8: closed without merge — the same terminal replacement, muted rather than landed. */
export const Closed: Story = {
  args: { model: { nodes: null, head: null, terminal: 'closed' }, openKey: null, pr: PR },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Closed')).toBeInTheDocument()
  },
}

/** R7: no ribbon at all until the tree differs from base — the pane shows tabs only, so
 * this renders nothing. */
export const Absent: Story = {
  args: { model: null, openKey: null, pr: null },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByLabelText('Work')).not.toBeInTheDocument()
  },
}
