import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { SidebarSearch } from './sidebar-search'

function SidebarSearchStory({
  populated = false,
  onChange,
}: {
  populated?: boolean
  onChange: (value: string) => void
}) {
  const [value, setValue] = useState(populated ? 'argo' : '')
  return (
    <div className="w-64 p-4">
      <SidebarSearch
        label="Search projects"
        placeholder="Search projects"
        value={value}
        onChange={(query) => {
          setValue(query)
          onChange(query)
        }}
        maxLength={60}
      />
    </div>
  )
}
const meta = {
  title: 'Design System/Patterns/Sidebar Search',
  component: SidebarSearchStory,
  args: { onChange: fn() },
} satisfies Meta<typeof SidebarSearchStory>
export default meta
type Story = StoryObj<typeof meta>
export const Search: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole('textbox', { name: 'Search projects' })
    await userEvent.type(input, 'argo')
    await expect(input).toHaveValue('argo')
    await expect(args.onChange).toHaveBeenCalledWith('argo')
    await userEvent.clear(input)
    await expect(input).toHaveValue('')
    await expect(args.onChange).toHaveBeenLastCalledWith('')
  },
}
export const Populated: Story = {
  args: { populated: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('textbox')).toHaveValue('argo')
  },
}
export const EmptyQuery: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('textbox', { name: 'Search projects' }),
    ).toHaveValue('')
  },
}
