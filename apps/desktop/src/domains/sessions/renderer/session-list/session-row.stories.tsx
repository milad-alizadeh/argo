import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { SessionRow } from './session-row'
import type { Session, SessionId } from '../types'
import { sessionRow } from '@/mocks/sessions/session-rows'

export const SESSION_STATUS_NAMES: Record<Session['status'], string> = {
  running: 'Working Session',
  starting: 'Starting Session',
  asking: 'Question Session',
  permission: 'Permission Session',
  ended: 'Ended Session',
  stopped: 'Stopped Session',
  unknown: 'Unknown Session',
  idle: 'Idle Session',
}

export function SessionToneSamples({ onSelect = () => {} }: { onSelect?: (id: SessionId) => void }) {
  return (
    <div className="w-80">
      {(Object.entries(SESSION_STATUS_NAMES) as [Session['status'], string][]).map(
        ([status, name]) => (
          <SessionRow
            checked={false}
            key={status}
            now={Date.parse('2026-09-01T00:00:00Z')}
            onFocus={() => {}}
            onSelect={onSelect}
            onToggleSelect={() => {}}
            selected={false}
            session={sessionRow({ id: status, name, status })}
            tabbable
            unavailable={false}
          />
        ),
      )}
    </div>
  )
}

const meta = {
  title: 'Features/Sessions/Session List/Session Row',
  component: SessionToneSamples,
  excludeStories: ['SESSION_STATUS_NAMES', 'SessionToneSamples'],
  args: { onSelect: fn() },
} satisfies Meta<typeof SessionToneSamples>
export default meta
type Story = StoryObj<typeof meta>

export const States: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    for (const name of Object.values(SESSION_STATUS_NAMES)) {
      await expect(canvas.getByRole('button', { name: new RegExp(name) })).toBeVisible()
    }
    await expect(canvas.getAllByText('Needs input')).toHaveLength(2)
    const question = canvas.getByRole('button', { name: /Question Session/ })
    await expect(question.querySelector('button, a')).toBeNull()
    await userEvent.click(question)
    await expect(args.onSelect).toHaveBeenCalledWith('asking')
  },
}
