import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { AppToneTreatments, NATIVE_BADGE_VARIANTS, NativeBadges } from '@/mocks/styling/badges'

const meta = {
  title: 'Components/DesignSystem/Badges',
  parameters: { layout: 'padded' },
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Native: Story = {
  render: () => <NativeBadges />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const variant of NATIVE_BADGE_VARIANTS) {
      await expect(canvas.getByText(variant, { exact: true })).toBeVisible()
    }
    await expect(canvas.getByRole('link', { name: 'Badge destination' })).toHaveAttribute(
      'href',
      '#badge-destination',
    )
    const remove = canvas.getByRole('button', { name: 'Remove badge' })
    await userEvent.tab()
    await expect(canvas.getByRole('link', { name: 'Badge destination' })).toHaveFocus()
    await userEvent.tab()
    await expect(remove).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await expect(canvas.getByLabelText('Removal count')).toHaveTextContent('1')
    await expect(canvas.getByRole('button', { name: 'Disabled badge' })).toBeDisabled()
    await expect(canvas.getByRole('link', { name: 'Destructive destination' })).toHaveAttribute(
      'href',
      '#badge-destination',
    )
  },
}

export const AppTreatments: Story = {
  render: () => <AppToneTreatments />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Needs input')).toBeVisible()
    await expect(canvas.queryByRole('button')).toBeNull()
    await expect(canvas.queryByRole('link')).toBeNull()
    await expect(canvas.getAllByRole('listitem')).toHaveLength(6)
  },
}
