import { expect, userEvent, within } from 'storybook/test'
import { longControlLabel, longInputValue } from './controls'

export async function playButtons({ canvasElement }: { canvasElement: HTMLElement }) {
  const canvas = within(canvasElement)
  const save = canvas.getByRole('button', { name: 'Save' })
  save.focus()
  await expect(save).toHaveFocus()
  await userEvent.keyboard('{Enter}')
  await expect(canvas.getByLabelText('Saved count')).toHaveTextContent('1')
  await userEvent.keyboard(' ')
  await expect(canvas.getByLabelText('Saved count')).toHaveTextContent('2')
  await userEvent.tab()
  await expect(canvas.getByRole('button', { name: 'Invalid action' })).toHaveFocus()
  await expect(canvas.getByRole('button', { name: 'Unavailable' })).toBeDisabled()
  await expect(canvas.getByRole('button', { name: 'Invalid action' })).toHaveAttribute(
    'aria-invalid',
    'true',
  )
  await expect(canvas.getByRole('button', { name: 'Search' })).toHaveAccessibleName('Search')
  await expect(canvas.getByRole('button', { name: longControlLabel })).toBeVisible()
}

export async function playInputs({ canvasElement }: { canvasElement: HTMLElement }) {
  const canvas = within(canvasElement)
  const input = canvas.getByRole('textbox', { name: 'Project name' })
  await userEvent.click(input)
  await userEvent.type(input, 'Argo')
  await expect(canvas.getByLabelText('Entered name')).toHaveTextContent('Argo')
  await userEvent.tab()
  await expect(canvas.getByRole('textbox', { name: 'Invalid input' })).toHaveFocus()
  await expect(canvas.getByRole('textbox', { name: 'Invalid input' })).toHaveAttribute(
    'aria-invalid',
    'true',
  )
  await expect(canvas.getByRole('textbox', { name: 'Unavailable input' })).toBeDisabled()
  await expect(canvas.getByRole('textbox', { name: 'Long path' })).toHaveValue(longInputValue)
}
