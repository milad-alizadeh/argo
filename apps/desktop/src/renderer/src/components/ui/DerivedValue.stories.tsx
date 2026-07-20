import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { DerivedValue } from './DerivedValue'

const meta = {
  title: 'Cockpit/DerivedValue',
  component: DerivedValue,
  argTypes: {
    text: { control: 'text' },
    title: { control: 'text' },
    gone: { control: 'boolean' },
  },
} satisfies Meta<typeof DerivedValue>

export default meta
type Story = StoryObj<typeof meta>

// Plain text: the provenance is reachable through `title`, never through decoration.
export const Default: Story = {
  args: { text: '~34k tokens', title: 'estimated from the token-usage sum' },
  play: async ({ canvasElement }) => {
    const value = within(canvasElement).getByText('~34k tokens')
    await expect(value).toHaveAttribute('title', 'estimated from the token-usage sum')
  },
}

// `gone` = the tool ran but its output was not captured, so the value is absent rather
// than estimated, and it dims.
export const Gone: Story = {
  args: { text: 'output not captured', title: 'tool ran; output not captured', gone: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('output not captured')).toHaveClass(
      'text-foreground-faint',
    )
  },
}
