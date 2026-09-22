import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { SessionContextBar } from '@/domains/sessions/renderer/composer/session-context-bar'

const meta = {
  args: {
    contextTokens: 148_000,
    contextWindowTokens: 200_000,
    harness: 'claude',
    isCompacting: false,
    onCompact: async () => true,
  },
  component: SessionContextBar,
  title: 'Sessions/Composer/Session Context Bar',
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

export const MeterAndLabels: Story = {
  parameters: { viewport: { defaultViewport: 'desktop' } },
  render: () => <ContextBarFrame width="75rem" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByLabelText(/Dumb zone/)).toBeVisible()
    const context = canvas.getByRole('button', { name: 'Context 74%' })
    await userEvent.click(context)
    await waitFor(() => expect(within(document.body).getByText('Context window')).toBeVisible())
    await expect(canvas.getByText('Compact')).toBeVisible()
    await expect(canvas.getByText('Handoff')).toBeVisible()
    const handoff = canvas
      .getAllByLabelText('Handoff Session')
      .find((button) => button.getBoundingClientRect().width > 0)
    if (handoff === undefined) throw new Error('The visible context bar actions are absent.')
  },
}

export const ProgressIconAndLabels: Story = {
  render: () => <ContextBarFrame width="39rem" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByLabelText(/Context 148k tokens/)).toBeVisible()
    await expect(canvas.getByText('Compact')).toBeVisible()
    await expect(canvas.getByText('Handoff')).toBeVisible()
  },
}

export const LabelsWaitForTheFullLayout: Story = {
  render: () => <ContextBarFrame width="55rem" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const bar = canvasElement.querySelector<HTMLElement>('[data-component="SessionContextBar"]')

    await expect(canvas.getByLabelText(/Context 148k tokens/)).toBeVisible()
    await expect(canvas.getByText('Compact')).toBeVisible()
    await expect(canvas.getByText('Handoff')).toBeVisible()
    if (bar === null) throw new Error('The context bar is absent.')

    expect(bar.scrollWidth).toBeLessThanOrEqual(bar.clientWidth)
  },
}

export const PercentageAndIcons: Story = {
  render: () => <ContextBarFrame width="22rem" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('button', { name: /Context 148k tokens/ })).toHaveAccessibleName(
      /74%/,
    )
    const labeledActions = canvas.getByText('Compact').parentElement
    if (labeledActions === null) throw new Error('The full context actions are absent.')
    await expect(labeledActions).not.toBeVisible()
  },
}
