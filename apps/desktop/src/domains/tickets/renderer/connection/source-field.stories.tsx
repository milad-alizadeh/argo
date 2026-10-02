import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import type { TicketScope } from '../hooks'
import { SourceField } from './source-field'

const scopes = [
  'octocat/hello-world',
  'octocat/spoon-knife',
  'octocat/atlas-of-forgotten-maps-and-marginalia',
].map((scope) => ({ scope, label: scope }))
function SourceFieldStory({
  empty = false,
  disabled = false,
  invalid = false,
  selected = false,
  narrow = false,
  onChange,
}: {
  empty?: boolean
  disabled?: boolean
  invalid?: boolean
  selected?: boolean
  narrow?: boolean
  onChange: (scope: TicketScope | null) => void
}) {
  const [scope, setScope] = useState<TicketScope | null>(selected ? (scopes[0] ?? null) : null)
  return (
    <div className={narrow ? 'w-48 p-4' : 'w-96 p-4'}>
      <SourceField
        provider="github"
        login="octocat"
        sources={{ state: 'listed', scopes: empty ? [] : scopes }}
        scope={scope}
        problem={invalid ? 'Choose a repository.' : null}
        pending={disabled}
        onChange={(value) => {
          setScope(value)
          onChange(value)
        }}
      />
    </div>
  )
}
const meta = {
  title: 'Features/Tickets/Connection/Source Field',
  component: SourceFieldStory,
  args: { onChange: fn() },
} satisfies Meta<typeof SourceFieldStory>
export default meta
type Story = StoryObj<typeof meta>
export const Picker: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const page = within(document.body)
    const input = canvas.getByRole('combobox', { name: 'Repository' })
    const trigger = canvas.getByRole('button', { name: 'Show repositories' })
    await userEvent.click(trigger)
    await page.findByRole('listbox')
    await userEvent.keyboard('{Escape}')
    await userEvent.click(input)
    await userEvent.type(input, 'SPOON')
    await expect(await page.findByRole('option', { name: 'octocat/spoon-knife' })).toBeVisible()
    await userEvent.keyboard('{ArrowDown}{Enter}')
    await expect(input).toHaveValue('octocat/spoon-knife')
    await expect(args.onChange).toHaveBeenCalledWith(scopes[1])
    await waitFor(() => expect(page.queryByRole('listbox')).toBeNull())
    await userEvent.keyboard('{ArrowDown}')
    await page.findByRole('listbox')
    await userEvent.keyboard('{Escape}')
    await expect(input).toHaveFocus()
    await waitFor(() => expect(page.queryByRole('listbox')).toBeNull())
    await expect(trigger).toHaveAttribute('tabindex', '-1')
  },
}
export const EmptyResults: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.type(within(canvasElement).getByRole('combobox'), 'missing')
    await expect(await within(document.body).findByText('No repository matches.')).toBeVisible()
  },
}
export const NoSources: Story = {
  args: { empty: true },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('combobox')
    await expect(input).toBeDisabled()
    await expect(input).toHaveAccessibleDescription(
      'octocat cannot see any repository with GitHub Issues turned on.',
    )
  },
}
export const Selected: Story = {
  args: { selected: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('combobox', { name: 'Repository' })).toHaveValue(
      'octocat/hello-world',
    )
  },
}
export const ClearsSelection: Story = {
  args: { selected: true },
  play: async ({ args, canvasElement }) => {
    const input = within(canvasElement).getByRole('combobox', { name: 'Repository' })
    await expect(input).toHaveValue('octocat/hello-world')
    await userEvent.clear(input)
    await expect(input).toHaveValue('')
    await expect(args.onChange).toHaveBeenLastCalledWith(null)
  },
}
export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('combobox')).toBeDisabled()
    await expect(canvas.getByRole('button', { name: 'Show repositories' })).toBeDisabled()
  },
}
export const Invalid: Story = {
  args: { invalid: true },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('combobox')
    await expect(input).toHaveAttribute('aria-invalid', 'true')
    await expect(input).toHaveAccessibleDescription('Choose a repository.')
  },
}
export const LongOptionNarrow: Story = {
  args: { narrow: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const page = within(document.body)
    const input = canvas.getByRole('combobox', { name: 'Repository' })
    await userEvent.click(canvas.getByRole('button', { name: 'Show repositories' }))
    const listbox = await page.findByRole('listbox', { name: 'Repository' })
    await userEvent.type(input, 'atlas-of-forgotten-maps')
    const option = await within(listbox).findByRole('option', { name: scopes[2]?.label })
    await expect(option).toBeVisible()
  },
}
