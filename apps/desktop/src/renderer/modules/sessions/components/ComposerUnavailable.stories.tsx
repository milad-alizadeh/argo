import type { Meta, StoryObj } from '@storybook/react'

import { ComposerUnavailable } from './ComposerUnavailable'

const meta: Meta<typeof ComposerUnavailable> = {
  title: 'Sessions/ComposerUnavailable',
  component: ComposerUnavailable,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof ComposerUnavailable>

export const ReadOnly: Story = { args: { availability: 'read-only' } }
export const Orphaned: Story = { args: { availability: 'orphaned' } }
export const Ended: Story = { args: { availability: 'ended' } }
