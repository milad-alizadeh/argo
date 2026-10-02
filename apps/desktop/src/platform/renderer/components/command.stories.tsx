import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './ui/command'

function CommandStory({
  disabled = false,
  invalid = false,
  empty = false,
  narrow = false,
  selected = false,
  onSelect,
}: {
  disabled?: boolean
  invalid?: boolean
  empty?: boolean
  narrow?: boolean
  selected?: boolean
  onSelect: (value: string) => void
}) {
  const [choice, setChoice] = useState(selected ? 'main' : '')
  return (
    <div className={narrow ? 'w-48 p-4' : 'w-80 p-4'}>
      <Command defaultValue={selected ? 'main' : undefined}>
        <CommandInput
          aria-label="Search commands"
          placeholder="Search commands"
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? 'command-problem' : undefined}
        />
        <CommandList aria-label="Commands">
          <CommandEmpty>
            <span aria-disabled="true" role="option" tabIndex={-1}>
              No commands found.
            </span>
          </CommandEmpty>
          <CommandGroup>
            {!empty &&
              ['main', 'feature/a-long-branch-name-for-a-narrow-picker'].map((value) => (
                <CommandItem
                  key={value}
                  value={value}
                  data-checked={choice === value}
                  onSelect={(value) => {
                    setChoice(value)
                    onSelect(value)
                  }}
                >
                  <span className="min-w-0 truncate">{value}</span>
                </CommandItem>
              ))}
            {!empty && (
              <CommandItem disabled value="unavailable">
                Unavailable
              </CommandItem>
            )}
          </CommandGroup>
        </CommandList>
      </Command>
      {invalid && <p id="command-problem">Choose an available command.</p>}
    </div>
  )
}
const meta = {
  title: 'Design System/Primitives/Command',
  component: CommandStory,
  args: { onSelect: fn() },
} satisfies Meta<typeof CommandStory>
export default meta
type Story = StoryObj<typeof meta>
export const Raw: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole('combobox', { name: 'Search commands' })
    await userEvent.type(input, 'missing')
    await expect(canvas.getByText('No commands found.')).toBeVisible()
    await userEvent.clear(input)
    await userEvent.type(input, 'main')
    await userEvent.keyboard('{ArrowDown}{Enter}')
    await expect(args.onSelect).toHaveBeenCalledWith('main')
    await expect(canvas.getByRole('option', { name: 'main' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await userEvent.clear(input)
    await expect(canvas.getByRole('option', { name: 'Unavailable', hidden: true })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  },
}
export const Empty: Story = {
  args: { empty: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('No commands found.')).toBeVisible()
  },
}
export const Selected: Story = {
  args: { selected: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('option', { name: 'main' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  },
}
export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('combobox')).toBeDisabled()
  },
}
export const Invalid: Story = {
  args: { invalid: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('combobox')).toHaveAccessibleDescription(
      'Choose an available command.',
    )
  },
}
export const LongOptionNarrow: Story = {
  args: { narrow: true },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('option', {
        name: 'feature/a-long-branch-name-for-a-narrow-picker',
      }),
    ).toBeVisible()
  },
}
