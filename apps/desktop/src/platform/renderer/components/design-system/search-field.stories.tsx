import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { SearchField } from './search-field'

const meta = {
  title: 'Design System/Patterns/Search Field',
  component: SearchField,
  args: { 'aria-label': 'Search sessions', placeholder: 'Search sessions' },
  decorators: [
    (Story) => (
      <div className="w-64 p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SearchField>
export default meta
type Story = StoryObj<typeof meta>
export const Search: Story = {
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('textbox', { name: 'Search sessions' })
    await userEvent.type(input, 'hello')
    await expect(input).toHaveValue('hello')
  },
}
export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('textbox')).toBeDisabled()
  },
}
export const Invalid: Story = {
  args: { 'aria-invalid': true, 'aria-describedby': 'search-problem' },
  decorators: [
    (Story) => (
      <>
        <Story />
        <p id="search-problem">Enter a search term.</p>
      </>
    ),
  ],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('textbox')).toHaveAccessibleDescription(
      'Enter a search term.',
    )
  },
}
