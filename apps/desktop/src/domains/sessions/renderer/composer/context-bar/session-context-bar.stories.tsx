import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'

import { SessionContextBar } from './session-context-bar'

const meta = {
  args: {
    contextTokens: 148_000,
    contextWindowTokens: 200_000,
    harness: 'claude',
    isCompacting: false,
    onCompact: fn(async () => true),
  },
  component: SessionContextBar,
  title: 'Features/Sessions/Composer/Session Context Bar',
} satisfies Meta<typeof SessionContextBar>

export default meta
type Story = StoryObj<typeof meta>

async function openContextActions(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  await userEvent.click(canvas.getByRole('button', { name: 'Context actions' }))
  await waitFor(() =>
    expect(within(document.body).getByRole('menuitem', { name: 'Compact context' })).toBeVisible(),
  )
}

export const MeterAndLabels: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await openContextActions(canvasElement)
    await expect(
      within(document.body).getByRole('menuitem', { name: 'Handoff Session' }),
    ).toBeVisible()
    await userEvent.keyboard('{Escape}')

    const context = canvas.getByRole('button', { name: /^Context (74%|148k tokens)/ })
    await expect(context).toHaveAccessibleName(/74%/)
    await userEvent.click(context)
    const body = within(document.body)
    await waitFor(() => expect(body.getByText('Context window')).toBeVisible())
    await expect(body.getByText('74% used · Dumb Zone')).toBeVisible()
    await expect(body.getByText('Smart Zone · Below 20%')).toBeVisible()
    await expect(body.getByText('Dumb Zone · 20%+')).toBeVisible()
    await expect(body.getByText('Loaded context')).toBeVisible()
    for (const label of ['Conversation', 'System prompt', 'MCP tools', 'Memory files', 'Skills']) {
      await expect(body.getByRole('progressbar', { name: label })).toBeVisible()
    }
    await expect(body.getByText(/treats 20% as a guide/)).toHaveTextContent(
      'Dex Horthy treats 20% as a guide. Compact before the next task.',
    )
    const source = body.getByRole('link', { name: 'Dex Horthy' })
    await expect(source).toBeVisible()
    await expect(source).toHaveAccessibleName('Dex Horthy')
    await expect(source).toHaveAttribute('target', '_blank')
    await expect(source).toHaveAttribute('rel', 'noopener noreferrer')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(body.queryByText('Context window')).toBeNull())
    await expect(context).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(body.getByText('Context window')).toBeVisible())
  },
}

export const ContextActionKeyboard: Story = {
  render: (args) => <SessionContextBar {...args} onHandoff={undefined} />,
  play: async ({ canvasElement, args }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'Context actions' })
    await userEvent.click(trigger)
    await within(document.body).findByRole('menuitem', { name: 'Compact context' })
    await expect(
      within(document.body).getByRole('menuitem', { name: 'Handoff Session' }),
    ).toHaveAttribute('aria-disabled', 'true')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(within(document.body).queryByRole('menu')).toBeNull())
    await expect(trigger).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    await waitFor(() =>
      expect(
        within(document.body).getByRole('menuitem', { name: 'Compact context' }),
      ).toHaveFocus(),
    )
    await userEvent.keyboard('{Enter}')
    await expect(args.onCompact).toHaveBeenCalled()
    await waitFor(() => expect(within(document.body).queryByRole('menu')).toBeNull())
    await expect(trigger).toHaveFocus()
  },
}

export const ContextActionsBusy: Story = {
  args: { isCompacting: true, isHandingOff: true, onHandoff: fn(async () => true) },
  play: async ({ canvasElement, args }) => {
    await openContextActions(canvasElement)
    for (const name of ['Compact context', 'Handoff Session']) {
      await expect(within(document.body).getByRole('menuitem', { name })).toHaveAttribute(
        'aria-disabled',
        'true',
      )
    }
    await userEvent.keyboard('{ArrowDown}{Enter}{Escape}')
    await expect(args.onCompact).not.toHaveBeenCalled()
    await expect(args.onHandoff).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(within(canvasElement).getByRole('button', { name: 'Context actions' })).toHaveFocus(),
    )
  },
}
