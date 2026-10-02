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

function ContextBarFrame({ width }: { width: string }) {
  return (
    <div style={{ width }}>
      <SessionContextBar
        contextTokens={148_000}
        contextWindowTokens={200_000}
        harness="claude"
        isCompacting={false}
        onCompact={async () => true}
      />
    </div>
  )
}

async function openContextActions(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  await userEvent.click(canvas.getByRole('button', { name: 'Context actions' }))
  await waitFor(() =>
    expect(within(document.body).getByRole('menuitem', { name: 'Compact context' })).toBeVisible(),
  )
}

export const MeterAndLabels: Story = {
  parameters: { viewport: { defaultViewport: 'desktop' } },
  render: () => <ContextBarFrame width="75rem" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByLabelText(/Dumb zone/)).toBeVisible()
    const context = canvas.getByRole('button', { name: 'Context 74%' })
    await userEvent.click(context)
    await waitFor(() => expect(within(document.body).getByText('Context window')).toBeVisible())
    await openContextActions(canvasElement)
    await expect(
      within(document.body).getByRole('menuitem', { name: 'Handoff Session' }),
    ).toBeVisible()
  },
}

export const ProgressIconAndLabels: Story = {
  render: () => <ContextBarFrame width="39rem" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByLabelText(/Context 148k tokens/)).toBeVisible()
    await openContextActions(canvasElement)
  },
}

export const LabelsWaitForTheFullLayout: Story = {
  render: () => <ContextBarFrame width="55rem" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByLabelText(/Context 148k tokens/)).toBeVisible()
    await openContextActions(canvasElement)
  },
}

export const PercentageAndIcons: Story = {
  render: () => <ContextBarFrame width="22rem" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('button', { name: /Context 148k tokens/ })).toHaveAccessibleName(
      /74%/,
    )
    await expect(canvas.getByRole('button', { name: 'Context actions' })).toBeVisible()
    await expect(
      within(document.body).queryByRole('menuitem', { name: 'Compact context' }),
    ).toBeNull()
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
    await expect(
      await within(document.body).findByRole('menuitem', { name: 'Compact context' }),
    ).toHaveFocus()
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
