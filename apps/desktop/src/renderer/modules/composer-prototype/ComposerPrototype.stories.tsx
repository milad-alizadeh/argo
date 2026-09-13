import type { Meta, StoryObj } from '@storybook/react'

import { ComposerPrototype } from './ComposerPrototype'

const meta: Meta<typeof ComposerPrototype> = {
  title: 'Reference/Composer Prototype',
  component: ComposerPrototype,
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta
type Story = StoryObj<typeof ComposerPrototype>

export const SourceOfTruth: Story = {}
