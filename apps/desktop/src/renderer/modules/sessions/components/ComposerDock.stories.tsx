import type { Meta, StoryObj } from '@storybook/react'
import '../screens/session-page.css'
import { ComposerDock } from './ComposerDock'
import { ComposerUnavailable } from './ComposerUnavailable'

const meta: Meta<typeof ComposerDock> = {
  title: 'Sessions/ComposerDock',
  component: ComposerDock,
  args: { children: <ComposerUnavailable availability="read-only" /> },
}

export default meta
type Story = StoryObj<typeof ComposerDock>

export const Unavailable: Story = {}
