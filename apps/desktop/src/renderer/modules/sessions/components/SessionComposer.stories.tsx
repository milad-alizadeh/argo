import type { Meta, StoryObj } from '@storybook/react'
import { useRef, useState } from 'react'
import { expect, userEvent, within } from 'storybook/test'

import { Button } from '../../../components/ui/button'
import { SessionComposer } from './SessionComposer'

function ComposerStory() {
  const [sessionId, setSessionId] = useState('session-one')
  const [sent, setSent] = useState<string | null>(null)

  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="mb-4 flex gap-2">
        <Button onClick={() => setSessionId('session-one')} type="button" variant="outline">
          Session one
        </Button>
        <Button onClick={() => setSessionId('session-two')} type="button" variant="outline">
          Session two
        </Button>
      </div>
      <SessionComposer
        onSend={async (text) => {
          setSent(text)
          return true
        }}
        sessionId={sessionId}
      />
      <output className="mt-4 block text-sm" data-testid="sent-message">
        {sent}
      </output>
    </div>
  )
}

function ManagedComposerStory() {
  const [running, setRunning] = useState(true)

  return (
    <div className="mx-auto max-w-4xl p-8">
      <SessionComposer
        isRunning={running}
        onInterrupt={async () => {
          setRunning(false)
          return true
        }}
        onSend={async () => false}
        sessionId="managed-session"
      />
    </div>
  )
}

function QueuedComposerStory() {
  const [running, setRunning] = useState(true)
  const [sent, setSent] = useState<string[]>([])

  return (
    <div className="mx-auto max-w-4xl p-8">
      <Button onClick={() => setRunning(false)} type="button" variant="outline">
        Finish turn
      </Button>
      <SessionComposer
        isRunning={running}
        onSend={async (text) => {
          setSent((current) => [...current, text])
          return true
        }}
        sessionId="queued-session"
      />
      <output data-testid="sent-messages">{sent.join(' · ')}</output>
    </div>
  )
}

function FailedQueuedComposerStory() {
  const [running, setRunning] = useState(true)

  return (
    <div className="mx-auto max-w-4xl p-8">
      <Button onClick={() => setRunning(false)} type="button" variant="outline">
        Finish turn
      </Button>
      <SessionComposer
        isRunning={running}
        onSend={async () => false}
        sessionId="failed-queued-session"
      />
    </div>
  )
}

// The send stays pending until the reader finishes it, so a Session switch can land mid-send.
function PendingSendStory() {
  const [sessionId, setSessionId] = useState('session-one')
  const finish = useRef<(sent: boolean) => void>(() => {})

  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="mb-4 flex gap-2">
        <Button onClick={() => setSessionId('session-two')} type="button" variant="outline">
          Session two
        </Button>
        <Button onClick={() => finish.current(true)} type="button" variant="outline">
          Finish send
        </Button>
      </div>
      <SessionComposer
        onSend={() =>
          new Promise<boolean>((resolve) => {
            finish.current = resolve
          })
        }
        sessionId={sessionId}
      />
    </div>
  )
}

const meta: Meta<typeof ComposerStory> = {
  title: 'Sessions/Composer',
  component: ComposerStory,
}

export default meta
type Story = StoryObj<typeof ComposerStory>

export const PlainText: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')

    await userEvent.click(composer)
    await userEvent.type(composer, 'Review the new Session shell.')
    await userEvent.keyboard('{Enter}')
    await expect(canvas.getByTestId('sent-message')).toHaveTextContent(
      'Review the new Session shell.',
    )
    await expect(composer.textContent).toBe('')
  },
}

export const ManagedTurn: Story = {
  render: () => <ManagedComposerStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')

    await userEvent.click(composer)
    await userEvent.type(composer, 'Keep this draft while the Turn stops.')
    await userEvent.click(canvas.getByRole('button', { name: 'Interrupt' }))
    await expect(composer).toHaveTextContent('Keep this draft while the Turn stops.')
    await expect(canvas.getByRole('button', { name: 'Send message' })).toBeEnabled()
  },
}

export const SendFinishesInAnotherSession: Story = {
  render: () => <PendingSendStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByLabelText('Message'))
    await userEvent.type(canvas.getByLabelText('Message'), 'Sent from session one.')
    await userEvent.keyboard('{Enter}')
    await userEvent.click(canvas.getByRole('button', { name: 'Session two' }))
    await userEvent.click(canvas.getByLabelText('Message'))
    await userEvent.type(canvas.getByLabelText('Message'), 'Drafted in session two.')
    await userEvent.click(canvas.getByRole('button', { name: 'Finish send' }))
    await expect(canvas.getByLabelText('Message')).toHaveTextContent('Drafted in session two.')
  },
}

export const QueuedTurn: Story = {
  render: () => <QueuedComposerStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')

    await userEvent.click(composer)
    await userEvent.type(composer, 'Run the focused checks after this Turn.')
    await userEvent.keyboard('{Enter}')

    await expect(canvas.getByRole('region', { name: 'Pending Turns' })).toHaveTextContent(
      'Run the focused checks after this Turn.',
    )
    await expect(canvas.getByTestId('sent-messages')).toHaveTextContent('')
    await userEvent.click(composer)
    await userEvent.type(composer, 'Then prepare the release notes.')
    await userEvent.keyboard('{Enter}')
    await userEvent.click(
      canvas.getByRole('button', {
        name: 'Move queued message up: Then prepare the release notes.',
      }),
    )
    await expect(canvas.getAllByRole('listitem')[0]).toHaveTextContent(
      'Then prepare the release notes.',
    )
    await userEvent.click(
      canvas.getByRole('button', {
        name: 'Remove queued message: Then prepare the release notes.',
      }),
    )
    await expect(
      canvas.getByRole('button', {
        name: 'Steer queued message: Run the focused checks after this Turn.',
      }),
    ).toHaveFocus()
    await userEvent.click(
      canvas.getByRole('button', {
        name: 'Edit queued message: Run the focused checks after this Turn.',
      }),
    )
    await expect(composer).toHaveTextContent('Run the focused checks after this Turn.')
    await expect(composer).toHaveFocus()
    await userEvent.click(canvas.getByRole('button', { name: 'Finish turn' }))
    await expect(canvas.getByTestId('sent-messages')).toHaveTextContent(
      'Run the focused checks after this Turn.',
    )
  },
}

export const FailedQueuedTurn: Story = {
  render: () => <FailedQueuedComposerStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')

    await userEvent.click(composer)
    await userEvent.type(composer, 'Keep this pending when Claude rejects it.')
    await userEvent.keyboard('{Enter}')
    await userEvent.click(canvas.getByRole('button', { name: 'Finish turn' }))
    await expect(canvas.getByRole('region', { name: 'Pending Turns' })).toHaveTextContent(
      'Keep this pending when Claude rejects it.',
    )
  },
}
