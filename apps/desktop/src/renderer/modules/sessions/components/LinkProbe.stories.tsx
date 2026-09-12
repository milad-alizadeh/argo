import type { Meta, StoryObj } from '@storybook/react'
import { LinkProbe } from './LinkProbe'

const meta: Meta<typeof LinkProbe> = { title: 'Sessions/LinkProbe', component: LinkProbe }

export default meta
type Story = StoryObj<typeof LinkProbe>

export const First: Story = { args: { label: 'first' } }
export const Second: Story = { args: { label: 'second' } }
