import type { Meta, StoryObj } from '@storybook/react-vite'

import { ComposerPrototype } from './composer-prototype'

const meta: Meta<typeof ComposerPrototype> = {
  title: 'Reference/Composer Prototype',
  component: ComposerPrototype,
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta
type Story = StoryObj<typeof ComposerPrototype>

// Frozen reference for the approved Session components (docs/design-stack.md); no play on purpose.
export const SourceOfTruth: Story = {}
