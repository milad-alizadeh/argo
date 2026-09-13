import type { Meta, StoryObj } from '@storybook/react'
import { useRef, useState } from 'react'
import { expect, userEvent, within } from 'storybook/test'

import { Button } from '../../../components/ui/button'
import type { SessionCli } from '../hooks/useSessionComposer'
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

function NewSessionCliStory() {
  const [cli, setCli] = useState<SessionCli>('claude')
  const [started, setStarted] = useState<string | null>(null)

  return (
    <div className="mx-auto max-w-4xl p-8">
      <SessionComposer
        cliPicker={{ cli, onChangeCli: setCli }}
        onSend={async (text) => {
          setStarted(`${cli}: ${text}`)
          return true
        }}
        sessionId="new:project-one"
      />
      <output className="mt-4 block text-sm" data-testid="started-session">
        {started}
      </output>
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

export const NewSessionChoosesCli: Story = {
  render: () => <NewSessionCliStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const claudeOption = canvas.getByRole('radio', { name: 'Claude Code' })
    const codexOption = canvas.getByRole('radio', { name: 'Codex' })

    await expect(claudeOption).toHaveAttribute('aria-checked', 'true')
    await expect(claudeOption).toHaveAttribute('tabindex', '0')
    await expect(codexOption).toHaveAttribute('tabindex', '-1')

    await userEvent.click(codexOption)
    await expect(codexOption).toHaveAttribute('aria-checked', 'true')

    // Arrow-key navigation per the WAI-ARIA radiogroup pattern: focus moves back to Claude Code,
    // and moving selection also moves the roving tabIndex.
    await expect(codexOption).toHaveFocus()
    await userEvent.keyboard('{ArrowLeft}')
    await expect(claudeOption).toHaveAttribute('aria-checked', 'true')
    await expect(claudeOption).toHaveFocus()
    await expect(claudeOption).toHaveAttribute('tabindex', '0')
    await expect(codexOption).toHaveAttribute('tabindex', '-1')

    await userEvent.keyboard('{End}')
    await expect(codexOption).toHaveAttribute('aria-checked', 'true')
    await expect(codexOption).toHaveFocus()

    await userEvent.click(canvas.getByLabelText('Message'))
    await userEvent.type(canvas.getByLabelText('Message'), 'Fix the flaky test.')
    await userEvent.keyboard('{Enter}')
    await expect(canvas.getByTestId('started-session')).toHaveTextContent(
      'codex: Fix the flaky test.',
    )
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
