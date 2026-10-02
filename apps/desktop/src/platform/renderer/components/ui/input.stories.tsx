import type { Meta, StoryObj } from '@storybook/react-vite'
import * as React from 'react'
import { expect, userEvent, within } from 'storybook/test'
import { Input } from './input'

const longInputValue = '/workspace/projects/an-example-with-a-long-directory-name/settings.json'

const meta = {
  title: 'Foundations/Primitives/Input',
  component: Input,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Input>
export default meta
type Story = StoryObj<typeof meta>

export const States: Story = {
  render: () => {
    const identifier = React.useId()
    const [value, setValue] = React.useState('')
    return (
      <div className="grid w-full max-w-80 gap-3">
        <label htmlFor={identifier}>Project name</label>
        <Input id={identifier} onChange={(event) => setValue(event.target.value)} value={value} />
        <Input aria-label="Unavailable input" defaultValue="Unavailable" disabled />
        <Input aria-describedby={`${identifier}-error`} aria-invalid aria-label="Invalid input" defaultValue="Invalid" />
        <p id={`${identifier}-error`}>A project name is required.</p>
        <Input aria-label="Long path" defaultValue={longInputValue} />
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole('textbox', { name: 'Project name' })
    await userEvent.type(input, 'Argo')
    await expect(input).toHaveValue('Argo')
    await userEvent.tab()
    await expect(canvas.getByRole('textbox', { name: 'Invalid input' })).toHaveFocus()
    await expect(canvas.getByRole('textbox', { name: 'Invalid input' })).toHaveAttribute('aria-invalid', 'true')
    await expect(canvas.getByRole('textbox', { name: 'Invalid input' })).toHaveAccessibleDescription('A project name is required.')
    await expect(canvas.getByRole('textbox', { name: 'Unavailable input' })).toBeDisabled()
    await expect(canvas.getByRole('textbox', { name: 'Long path' })).toHaveValue(longInputValue)
  },
}
