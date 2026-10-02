import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useId, useState } from 'react'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { Input } from '../ui/input'
import { Slider } from '../ui/slider'
import { RangeField } from './range-field'

function EffortField() {
  const labelId = useId()
  const selectedEffortId = useId()
  const [index, setIndex] = useState(1)
  const efforts = ['Low', 'Medium', 'High']
  return (
    <RangeField
      labelId={labelId}
      className="grid gap-2 border-t p-2.5"
      label={<span>Effort</span>}
      description={<span>{efforts[index]}</span>}
    >
      <div>
        <Slider
          aria-labelledby={`${labelId} ${selectedEffortId}`}
          min={0}
          max={efforts.length - 1}
          step={1}
          value={[index]}
          onValueChange={(value) => setIndex(Array.isArray(value) ? value[0] : value)}
        />
      </div>
      <div>
        {efforts.map((effort) => (
          <span key={effort} id={efforts[index] === effort ? selectedEffortId : undefined}>
            {effort}{' '}
          </span>
        ))}
      </div>
    </RangeField>
  )
}

function ThresholdField() {
  const labelId = useId()
  const thresholdLabelId = useId()
  const [threshold, setThreshold] = useState(100_000)
  const [thresholdInput, setThresholdInput] = useState(String(threshold))
  useEffect(() => {
    setThresholdInput(String(threshold))
  }, [threshold])
  return (
    <RangeField
      labelId={labelId}
      className="grid gap-2.5 border-t pt-3"
      label={<span>Automatic compaction</span>}
      description={<span>At {Math.round((threshold / 200_000) * 100)}% of total</span>}
    >
      <div>
        <span className="sr-only" id={thresholdLabelId}>
          Automatic compaction threshold
        </span>
        <Slider
          aria-labelledby={thresholdLabelId}
          min={40}
          max={95}
          step={5}
          value={[Math.round((threshold / 200_000) * 100)]}
          onValueChange={(value) => {
            const percent = Array.isArray(value) ? value[0] : value
            setThreshold(Math.round((200_000 * percent) / 100))
          }}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <span>Threshold</span>
        <Input
          aria-label="Threshold in tokens"
          max={190_000}
          min={80_000}
          step={1000}
          type="number"
          value={thresholdInput}
          onChange={(event) => setThresholdInput(event.target.value)}
          onBlur={() => {
            const nextThreshold = Math.min(
              190_000,
              Math.max(80_000, Number(thresholdInput) || threshold),
            )
            setThreshold(nextThreshold)
          }}
        />
      </div>
    </RangeField>
  )
}

const meta = {
  title: 'Design System/Patterns/Range Field',
  parameters: { layout: 'padded' },
} satisfies Meta<typeof RangeField>
export default meta
type Story = StoryObj<typeof meta>

export const EffortSelection: Story = {
  render: () => <EffortField />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const slider = canvas.getByRole('slider', { name: 'Effort Medium' })
    await expect(slider).toHaveAttribute('aria-valuenow', '1')
    slider.focus()
    await userEvent.keyboard('{End}')
    await expect(slider).toHaveAttribute('aria-valuenow', '2')
    await userEvent.keyboard('{Home}')
    await expect(slider).toHaveAttribute('aria-valuenow', '0')
    await userEvent.keyboard('{PageUp}')
    await expect(slider).toHaveAttribute('aria-valuenow', '2')
    await userEvent.keyboard('{PageDown}')
    await expect(slider).toHaveAttribute('aria-valuenow', '0')
    await userEvent.keyboard('{ArrowRight}')
    await expect(slider).toHaveAttribute('aria-valuenow', '1')
    await expect(slider).toHaveAccessibleName('Effort Medium')
  },
}

export const ThresholdBoundsAndInvalidInput: Story = {
  render: () => <ThresholdField />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const slider = canvas.getByRole('slider', { name: 'Automatic compaction threshold' })
    const input = canvas.getByRole('spinbutton', { name: 'Threshold in tokens' })
    await expect(slider).toHaveAttribute('aria-valuenow', '50')
    await expect(input).toHaveValue(100_000)
    await userEvent.clear(input)
    await userEvent.tab()
    await expect(input).toHaveValue(null)
    await userEvent.click(input)
    await userEvent.clear(input)
    await userEvent.type(input, '1000000')
    await userEvent.tab()
    await waitFor(() => expect(input).toHaveValue(190_000))
  },
}
