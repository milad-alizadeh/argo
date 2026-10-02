import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { NativeSelect, NativeSelectOption } from './native-select'

const meta = { title: 'Foundations/Primitives/Native Select', component: NativeSelect } satisfies Meta<typeof NativeSelect>
export default meta
type Story = StoryObj<typeof meta>

export const Options: Story = {
  render: () => <label>Default branch <NativeSelect defaultValue="main"><NativeSelectOption value="main">main</NativeSelectOption><NativeSelectOption value="develop">develop</NativeSelectOption></NativeSelect></label>,
  play: async ({ canvasElement }) => {
    const select = within(canvasElement).getByRole('combobox', { name: 'Default branch' })
    await userEvent.selectOptions(select, 'develop')
    await expect(select).toHaveValue('develop')
  },
}
