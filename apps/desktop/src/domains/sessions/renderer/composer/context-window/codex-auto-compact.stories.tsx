import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fireEvent, userEvent, waitFor, within } from 'storybook/test'
import { AutoCompactControl } from '@/harnesses/codex/presentation/codex-auto-compact'

function AutoCompactStory({ capacityTokens }: { capacityTokens: number | null }) {
  const [threshold, setThreshold] = useState(100_000)
  return (
    <div className="max-w-lg">
      <AutoCompactControl
        capacityTokens={capacityTokens}
        threshold={threshold}
        setThreshold={setThreshold}
      />
    </div>
  )
}

const meta = {
  title: 'Features/Sessions/Context Window/Codex Auto Compact',
  parameters: { layout: 'padded' },
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const ThresholdBoundsAndInvalidInput: Story = {
  render: () => <AutoCompactStory capacityTokens={200_000} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const slider = canvas.getByRole('slider', { name: 'Auto-compact threshold' })
    const input = canvas.getByRole('spinbutton', { name: 'Auto-compact threshold tokens' })
    await expect(slider).toHaveAttribute('aria-valuenow', '50')
    await expect(input).toHaveValue(100_000)

    await userEvent.click(input)
    await expect(input).toHaveFocus()
    await userEvent.clear(input)
    await userEvent.tab()
    await expect(input).toHaveValue(null)

    fireEvent.change(slider, { target: { value: '40' } })
    await expect(input).toHaveValue(80_000)

    await userEvent.click(input)
    await userEvent.clear(input)
    await userEvent.type(input, '250000')
    fireEvent.blur(input)
    await waitFor(() => expect(input).toHaveValue(190_000))
    await expect(slider).toHaveAttribute('aria-valuenow', '95')
  },
}

export const KeepsThresholdWhenCapacityIsUnavailable: Story = {
  render: () => <AutoCompactStory capacityTokens={null} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const slider = canvas.getByRole('slider', { name: 'Auto-compact threshold' })
    const input = canvas.getByRole('spinbutton', { name: 'Auto-compact threshold tokens' })
    await expect(slider).toHaveAttribute('aria-valuenow', '40')
    await expect(input).toHaveValue(100_000)
    fireEvent.change(slider, { target: { value: '95' } })
    await expect(slider).toHaveAttribute('aria-valuenow', '40')
    await expect(input).toHaveValue(100_000)
  },
}
