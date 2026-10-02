import { Field as FieldPrimitive } from '@base-ui/react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from './ui/combobox'

const options = ['main', 'feature/worktree-session-history-and-recovery']
function ComboboxStory({
  disabled = false,
  invalid = false,
  empty = false,
  narrow = false,
  selected = false,
}: {
  disabled?: boolean
  invalid?: boolean
  empty?: boolean
  narrow?: boolean
  selected?: boolean
}) {
  return (
    <div className={narrow ? 'w-48 p-4' : 'w-80 p-4'}>
      <FieldPrimitive.Root invalid={invalid} disabled={disabled}>
        <FieldPrimitive.Label>Branch</FieldPrimitive.Label>
        <Combobox
          items={empty ? [] : options}
          defaultValue={selected ? 'main' : null}
          disabled={disabled}
          autoHighlight
        >
          <ComboboxInput
            placeholder="Choose branch"
            disabled={disabled}
            aria-describedby={invalid ? 'combobox-problem' : undefined}
          />
          <ComboboxContent>
            <ComboboxEmpty>No branches found.</ComboboxEmpty>
            <ComboboxList aria-label="Branches">
              {(option: string) => (
                <ComboboxItem key={option} value={option}>
                  <span className="min-w-0 truncate">{option}</span>
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
        {invalid && <p id="combobox-problem">Choose an available branch.</p>}
      </FieldPrimitive.Root>
    </div>
  )
}
const meta = {
  title: 'Design System/Primitives/Combobox',
  component: ComboboxStory,
} satisfies Meta<typeof ComboboxStory>
export default meta
type Story = StoryObj<typeof meta>
export const Raw: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const page = within(document.body)
    const input = canvas.getByRole('combobox', { name: 'Branch' })
    await userEvent.type(input, 'missing')
    await expect(await page.findByText('No branches found.')).toBeVisible()
    await userEvent.clear(input)
    await userEvent.type(input, 'main')
    await userEvent.keyboard('{ArrowDown}{Enter}')
    await expect(input).toHaveValue('main')
    await waitFor(() => expect(page.queryByRole('listbox')).toBeNull())
    await userEvent.keyboard('{ArrowDown}')
    await page.findByRole('listbox')
    await userEvent.keyboard('{Escape}')
    await expect(input).toHaveFocus()
    await waitFor(() => expect(page.queryByRole('listbox')).toBeNull())
  },
}
export const Empty: Story = {
  args: { empty: true },
  play: async ({ canvasElement }) => {
    await userEvent.type(within(canvasElement).getByRole('combobox'), 'a')
    await expect(await within(document.body).findByText('No branches found.')).toBeVisible()
  },
}
export const Selected: Story = {
  args: { selected: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('combobox')).toHaveValue('main')
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
      'Choose an available branch.',
    )
  },
}
export const LongOptionNarrow: Story = {
  args: { narrow: true },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('combobox')
    await userEvent.click(input)
    await userEvent.type(input, 'session-history')
    await expect(
      await within(document.body).findByRole('option', { name: options[1] }),
    ).toBeVisible()
  },
}
