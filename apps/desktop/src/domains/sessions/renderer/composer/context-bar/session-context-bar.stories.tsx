import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { SessionContextBar } from './session-context-bar'

const meta = {
  args: {
    contextTokens: 148_000,
    contextWindowTokens: 200_000,
    harness: 'claude',
    isCompacting: false,
    onCompact: async () => true,
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
    const handoff = within(document.body)
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
    await openContextActions(canvasElement)
  },
}

export const LabelsWaitForTheFullLayout: Story = {
  render: () => <ContextBarFrame width="55rem" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const bar = canvasElement.querySelector<HTMLElement>('[data-component="SessionContextBar"]')

    await expect(canvas.getByLabelText(/Context 148k tokens/)).toBeVisible()
    await openContextActions(canvasElement)
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
    await expect(canvas.getByRole('button', { name: 'Context actions' })).toBeVisible()
    await expect(
      within(document.body).queryByRole('menuitem', { name: 'Compact context' }),
    ).toBeNull()
  },
}
