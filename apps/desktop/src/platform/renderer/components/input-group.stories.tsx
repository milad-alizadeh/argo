import { MagnifyingGlassIcon } from '@phosphor-icons/react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { InputGroup, InputGroupAddon, InputGroupInput } from './ui/input-group'

function InputGroupStory({
  disabled = false,
  invalid = false,
  populated = false,
}: {
  disabled?: boolean
  invalid?: boolean
  populated?: boolean
}) {
  return (
    <div className="w-80 p-4">
      <InputGroup>
        <InputGroupAddon>
          <MagnifyingGlassIcon />
        </InputGroupAddon>
        <InputGroupInput
          aria-label="Search files"
          placeholder="Search files"
          defaultValue={populated ? 'README.md' : ''}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? 'input-group-problem' : undefined}
        />
      </InputGroup>
      {invalid && <p id="input-group-problem">Enter a file name.</p>}
    </div>
  )
}
const meta = {
  title: 'Design System/Primitives/Input Group',
  component: InputGroupStory,
} satisfies Meta<typeof InputGroupStory>
export default meta
type Story = StoryObj<typeof meta>
export const Raw: Story = {
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('textbox', { name: 'Search files' })
    await userEvent.type(input, 'argo')
    await expect(input).toHaveValue('argo')
  },
}
export const Populated: Story = {
  args: { populated: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('textbox')).toHaveValue('README.md')
  },
}
export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('textbox')).toBeDisabled()
  },
}
export const Invalid: Story = {
  args: { invalid: true },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('textbox')
    await expect(input).toHaveAttribute('aria-invalid', 'true')
    await expect(input).toHaveAccessibleDescription('Enter a file name.')
  },
}
