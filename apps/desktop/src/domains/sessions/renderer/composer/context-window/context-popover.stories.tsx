import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fireEvent, userEvent, waitFor, within } from 'storybook/test'

import {
  makeStorybookAutoCompactLimitUnreadable,
  resetStorybookAutoCompactLimit,
  writtenAutoCompactLimits,
} from '../../../../../../.storybook/storybook-auto-compact'
import { ContextPopover } from './context-popover'

const meta = {
  title: 'Features/Sessions/Composer/Context Popover',
  component: ContextPopover,
  args: { capacityTokens: 200_000, harness: 'codex', percentage: 74, usedTokens: 148_000 },
  decorators: [(Story) => <div className="p-16">{Story()}</div>],
} satisfies Meta<typeof ContextPopover>

export default meta
type Story = StoryObj<typeof ContextPopover>

export const AutoCompactWritesToTheHarnessConfig: Story = {
  beforeEach: resetStorybookAutoCompactLimit,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Context details' }))

    const body = within(document.body)
    const slider = await body.findByRole('slider', { name: 'Auto-compact threshold' })
    await waitFor(() => expect(slider).toHaveValue('90'))

    fireEvent.change(slider, { target: { value: '70' } })
    await waitFor(() => expect(writtenAutoCompactLimits.at(-1)).toBe(140_000))
    const tokens = body.getByRole('spinbutton', { name: 'Auto-compact threshold tokens' })
    await waitFor(() => expect(tokens).toHaveValue(140_000))

    await userEvent.clear(tokens)
    await userEvent.type(tokens, '155000')
    await userEvent.tab()
    await waitFor(() => expect(writtenAutoCompactLimits.at(-1)).toBe(155_000))
    // 78% is the true value; the range input's own step sanitization snaps its displayed
    // position to the nearest multiple of 5, same as a person dragging it would see.
    await expect(slider).toHaveValue('80')
  },
}

export const AutoCompactReportsAnUnreadableConfig: Story = {
  beforeEach: makeStorybookAutoCompactLimitUnreadable,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Context details' }))

    const body = within(document.body)
    const failure = await body.findByText(
      'The auto-compact limit in this Harness config could not be read.',
    )
    await waitFor(() => expect(failure).toBeVisible())
    await expect(body.queryByRole('slider', { name: 'Auto-compact threshold' })).toBeNull()
    expect(writtenAutoCompactLimits).toEqual([])
  },
}

export const ExplainsContextZones: Story = {
  beforeEach: resetStorybookAutoCompactLimit,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: 'Context details' })
    await userEvent.click(trigger)
    const body = within(document.body)
    await waitFor(() => expect(body.getByText('74% used · Dumb Zone')).toBeVisible())
    await expect(body.getByText('Smart Zone · Below 20%')).toBeVisible()
    await expect(body.getByText('Dumb Zone · 20%+')).toBeVisible()
    await expect(body.queryByText(/Working target|Current ·/)).toBeNull()
    await expect(body.getByText(/Before the next task, compact/)).toBeVisible()
    for (const [name, href] of [
      ['Matt Pocock', 'https://www.youtube.com/watch?v=-QFHIoCo-Ko&t=192s'],
      ['Dex Horthy', 'https://www.youtube.com/watch?v=rmvDxxNubIg&t=355s'],
    ]) {
      const link = body.getByRole('link', { name })
      await expect(link).toHaveAttribute('href', href)
      await expect(link).toHaveAttribute('target', '_blank')
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(body.queryByText('Smart Zone · Below 20%')).toBeNull())
    await expect(trigger).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(body.getByText('Smart Zone · Below 20%')).toBeVisible())
  },
}

export const SmartZoneBelowTwentyPercent: Story = {
  args: { percentage: 19, usedTokens: 38_000 },
  beforeEach: resetStorybookAutoCompactLimit,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Context details' }))
    await waitFor(() =>
      expect(within(document.body).getByText('19% used · Smart Zone')).toBeVisible(),
    )
  },
}

export const DumbZoneAtTwentyPercent: Story = {
  args: { percentage: 20, usedTokens: 40_000 },
  beforeEach: resetStorybookAutoCompactLimit,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Context details' }))
    await waitFor(() =>
      expect(within(document.body).getByText('20% used · Dumb Zone')).toBeVisible(),
    )
  },
}
