import type { Meta, StoryObj } from '@storybook/react'
import { SessionStatus } from './SessionStatus'

const meta: Meta<typeof SessionStatus> = { title: 'Sessions/SessionStatus', component: SessionStatus, tags: ['autodocs'] }
export default meta
type Story = StoryObj<typeof SessionStatus>
export const Active: Story = { args: { status: 'active' } }
export const Idle: Story = { args: { status: 'idle' } }
export const Waiting: Story = { args: { status: 'waiting' } }
export const Failed: Story = { args: { status: 'failed' } }
