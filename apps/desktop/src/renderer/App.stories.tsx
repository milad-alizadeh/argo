import type { Meta, StoryObj } from '@storybook/react'

import { AppSurface, type RuntimeVersions } from './App'

type StoryContext = { versions: RuntimeVersions }

const meta: Meta<StoryContext> = {
  title: 'Desktop/AppSurface',
  component: AppSurface,
  tags: ['autodocs'],
  argTypes: {
    versions: {
      control: {
        type: 'object',
      },
    },
  },
}

export default meta

type Story = StoryObj<StoryContext>

export const Default: Story = {
  args: {
    versions: {
      electron: '44.2.0',
      chrome: '132.0.0',
    },
  },
}
