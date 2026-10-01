import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { Button } from '../../components/ui/button'
import { applyAppearance, useTheme } from '../../use-appearance'
import { AppearanceDialog } from './appearance-dialog'

function AppearanceStory({ reject = false }: { reject?: boolean }) {
  const { t } = useTranslation('app')
  const [open, setOpen] = useState(false)
  const state = useTheme()
  return (
    <>
      <Button onClick={() => setOpen(true)}>{t('rail.settings')}</Button>
      <AppearanceDialog
        state={state}
        open={open}
        onOpenChange={setOpen}
        onChoose={async (preference) => {
          if (reject) return false
          const result = await window.argo.setAppearance(preference)
          applyAppearance(result.state)
          return result.ok
        }}
      />
    </>
  )
}

const meta = {
  title: 'App/Navigation Rail/Appearance Dialog',
  component: AppearanceStory,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof AppearanceStory>
export default meta
type Story = StoryObj<typeof meta>

export const Selection: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Settings' }))
    const body = within(canvasElement.ownerDocument.body)
    const dialog = body.getByRole('dialog', { name: 'Appearance' })
    const popup = within(dialog)
    await expect(popup.getByRole('radio', { name: 'System' })).toBeChecked()
    await userEvent.click(popup.getByRole('radio', { name: 'Graphite' }))
    await expect(popup.getByRole('radio', { name: 'Graphite' })).toBeChecked()
    await userEvent.click(popup.getByRole('radio', { name: 'Neutral' }))
    await expect(popup.getByRole('radio', { name: 'Neutral' })).toBeChecked()
    const system = popup.getByRole('radio', { name: 'System' })
    system.focus()
    await userEvent.keyboard('{ArrowDown}')
    await expect(popup.getByRole('radio', { name: 'Light' })).toBeChecked()
    await userEvent.keyboard('{ArrowDown}')
    await expect(popup.getByRole('radio', { name: 'Dark' })).toBeChecked()
    await userEvent.click(popup.getByRole('radio', { name: 'System' }))
  },
}

export const FocusReturn: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const settings = canvas.getByRole('button', { name: 'Settings' })
    await userEvent.click(settings)
    const body = within(canvasElement.ownerDocument.body)
    await waitFor(() => expect(body.getByRole('dialog', { name: 'Appearance' })).toBeVisible())
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(settings).toHaveFocus())
    await userEvent.click(settings)
    await userEvent.click(body.getByRole('button', { name: 'Close Appearance' }))
    await waitFor(() => expect(settings).toHaveFocus())
  },
}

export const RejectedSelection: Story = {
  args: { reject: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Settings' }))
    const body = within(canvasElement.ownerDocument.body)
    const popup = within(body.getByRole('dialog', { name: 'Appearance' }))
    const initial = popup.getByRole('radio', { checked: true, name: /Neutral|Graphite/ })
    const graphite = popup.getByRole('radio', { name: 'Graphite' })
    const alternative =
      initial === graphite ? popup.getByRole('radio', { name: 'Neutral' }) : graphite
    await userEvent.click(alternative)
    await expect(popup.getByRole('alert')).toHaveTextContent('Your change could not be saved.')
    await expect(initial).toBeChecked()
  },
}

export const NarrowWindow: Story = {
  globals: { viewport: { value: 'compact', isRotated: false } },
  play: Selection.play,
}
