import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { DerivedValue } from './DerivedValue'

const meta = {
  title: 'Cockpit/DerivedValue',
  component: DerivedValue,
} satisfies Meta<typeof DerivedValue>

export default meta
type Story = StoryObj<typeof meta>

export const Estimated: Story = {
  args: { text: '~34k tokens', title: 'estimated from the token-usage sum' },
  play: async ({ canvasElement }) => {
    const value = within(canvasElement).getByText('~34k tokens')
    await expect(value).toHaveAttribute('title', 'estimated from the token-usage sum')
    await expect(value).toHaveClass('underline')
  },
}

// `gone` = the tool ran but its output was not captured — there is no value to underline.
export const Gone: Story = {
  args: { text: 'output not captured', title: 'tool ran; output not captured', gone: true },
  play: async ({ canvasElement }) => {
    const value = within(canvasElement).getByText('output not captured')
    await expect(value).toHaveClass('no-underline')
  },
}

export const LongProvenance: Story = {
  args: {
    text: '~12 files',
    title: 'estimated from the snapshot diff taken before and after the tool call',
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('~12 files')).toBeInTheDocument()
  },
}

export const EmptyText: Story = {
  args: { text: '', title: 'no value parsed from stdout' },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('span')?.textContent).toBe('')
  },
}
