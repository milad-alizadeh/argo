import type { Meta, StoryObj } from '@storybook/react'
import { ComposerPrototype } from './ComposerPrototype'

const meta: Meta<typeof ComposerPrototype> = {
  title: 'Composer/Chip appearance',
  component: ComposerPrototype,
  parameters: { layout: 'fullscreen' },
}

export default meta
type Story = StoryObj<typeof ComposerPrototype>

export const RecognizedChips: Story = {}
