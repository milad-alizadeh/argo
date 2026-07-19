import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import App from './App'

const meta = {
  title: 'Cockpit/App',
  component: App,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof App>

export default meta
type Story = StoryObj<typeof meta>

// The empty-window skeleton state (issue #2): no Session observed yet.
export const EmptyWindow: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Argo Cockpit')).toBeInTheDocument()
    await expect(canvas.getByText('No Sessions observed yet.')).toBeInTheDocument()
  },
}
