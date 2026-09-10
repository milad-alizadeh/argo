import type { Meta, StoryObj } from '@storybook/react'
import { SessionsEmptyState } from './SessionsEmptyState'

const meta: Meta<typeof SessionsEmptyState> = { title: 'Sessions/SessionsEmptyState', component: SessionsEmptyState, tags: ['autodocs'] }
export default meta
type Story = StoryObj<typeof SessionsEmptyState>
export const Loading: Story = { args: { message: 'Reading Claude sessions...' } }
export const Empty: Story = { args: { message: 'Select a session to read its terminal activity.' } }
export const Failure: Story = { args: { message: 'Unable to list sessions.' } }
