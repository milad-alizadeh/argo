import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'

import { SessionContextBar } from './SessionContextBar'

const meta = {
  args: {
    contextTokens: 148_000,
    harness: 'claude',
    isCompacting: false,
    onCompact: async () => true,
  },
  component: SessionContextBar,
  title: 'Sessions/SessionContextBar',
} satisfies Meta<typeof SessionContextBar>

export default meta
type Story = StoryObj<typeof meta>

function ContextBarFrame({ width }: { width: string }) {
  return (
    <div style={{ width }}>
      <SessionContextBar
        contextTokens={148_000}
        harness="claude"
        isCompacting={false}
        onCompact={async () => true}
      />
    </div>
  )
}

export const MeterAndLabels: Story = {
  render: () => <ContextBarFrame width="56rem" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByLabelText(/Dumb zone/)).toBeVisible()
    await expect(canvas.getByText('Compact')).toBeVisible()
    await expect(canvas.getByText('Handoff')).toBeVisible()
    const bar = canvasElement.querySelector<HTMLElement>('[data-component="SessionContextBar"]')
    const handoff = canvas
      .getAllByLabelText('Handoff Session')
      .find((button) => button.getBoundingClientRect().width > 0)
    const actions = handoff?.parentElement
    if (bar === null || actions === null || actions === undefined)
      throw new Error('The visible context bar actions are absent.')

    const barStyle = getComputedStyle(bar)
    expect(bar.getBoundingClientRect().right - actions.getBoundingClientRect().right).toBeCloseTo(
      Number.parseFloat(barStyle.paddingRight) + Number.parseFloat(barStyle.borderRightWidth),
      1,
    )
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

export const PercentageAndIcons: Story = {
  render: () => <ContextBarFrame width="22rem" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('button', { name: /Context 148k tokens/ })).toHaveAccessibleName(
      /74%/,
    )
    expect(getComputedStyle(canvas.getByText('Compact')).display).toBe('none')
    expect(getComputedStyle(canvas.getByText('Handoff')).display).toBe('none')
  },
}
