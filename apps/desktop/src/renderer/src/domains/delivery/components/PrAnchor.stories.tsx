import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { PrAnchor } from './PrAnchor'

const meta = {
  title: 'Delivery/PrAnchor',
  component: PrAnchor,
  argTypes: {
    prNum: { control: { type: 'number', min: 1 } },
    ghUrl: { control: 'text' },
  },
} satisfies Meta<typeof PrAnchor>

export default meta
type Story = StoryObj<typeof meta>

/** The lifecycle strip's trailing anchor once a PR exists (R9) — number, target and a GitHub
 * link, all pointing at facts typed exactly once elsewhere on screen. */
export const Default: Story = {
  args: { prNum: 42, ghUrl: 'https://github.com/milad-alizadeh/argo/pull/42' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('PR #42')).toBeInTheDocument()
    await expect(canvas.getByText('main')).toBeInTheDocument()
    const link = canvas.getByRole('link', { name: /GitHub/ })
    await expect(link).toHaveAttribute('href', 'https://github.com/milad-alizadeh/argo/pull/42')
  },
}
