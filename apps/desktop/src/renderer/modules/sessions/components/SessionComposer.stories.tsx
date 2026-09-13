import type { Meta, StoryObj } from '@storybook/react'
import { useRef, useState } from 'react'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { Button } from '../../../components/ui/button'
import type { SessionCli } from '../hooks/useSessionComposer'
import { CLAUDE_TURN_SETUP } from '../turn-setup/claude-turn-setup'
import { SessionComposer } from './SessionComposer'

const plan = {
  state: 'available' as const,
  entries: [{ content: 'Choose the base layout', position: 0, status: 'in_progress' as const }],
}

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
        plan={null}
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
        plan={null}
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
        plan={null}
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
        plan={null}
        sessionId="new:project-one"
      />
      <output className="mt-4 block text-sm" data-testid="started-session">
        {started}
      </output>
    </div>
  )
}

function SetupComposerStory({
  running = false,
  sessionId,
}: {
  running?: boolean
  sessionId: string
}) {
  const [isRunning, setRunning] = useState(running)
  const [setup, setSetup] = useState(CLAUDE_TURN_SETUP.opening)
  const [sent, setSent] = useState<string[]>([])

  return (
    <div className="mx-auto max-w-4xl p-8 pt-96">
      <Button onClick={() => setRunning(false)} type="button" variant="outline">
        Finish turn
      </Button>
      <SessionComposer
        isRunning={isRunning}
        onSend={async (text, turnSetup) => {
          setSent((current) => [
            ...current,
            `${text} (${turnSetup?.model} ${turnSetup?.effort} ${turnSetup?.mode})`,
          ])
          return true
        }}
        sessionId={sessionId}
        setup={{ choices: CLAUDE_TURN_SETUP, value: setup, onChange: setSetup }}
      />
      <output data-testid="sent-messages">{sent.join(' · ')}</output>
    </div>
  )
}

async function chooseMode(canvasElement: HTMLElement, mode: RegExp) {
  await userEvent.click(
    within(canvasElement).getByRole('button', { name: /^Choose permission mode/ }),
  )
  await userEvent.click(await within(document.body).findByRole('menuitemradio', { name: mode }))
  await waitFor(() => expect(within(document.body).queryByRole('menu')).toBeNull())
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

export const WithPlan: Story = {
  render: () => (
    <div className="mx-auto max-w-4xl p-8">
      <SessionComposer onSend={async () => true} plan={plan} sessionId="planned-session" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const composer = within(canvasElement).getByLabelText('Message')
    await expect(composer.parentElement?.parentElement).toHaveClass('min-h-40')
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
    await expect(canvas.getAllByRole('listitem')[1]).toHaveClass(
      'session-page__queued-message--enter',
    )
    await userEvent.click(
      canvas.getByRole('button', {
        name: 'Remove queued message: Run the focused checks after this Turn.',
      }),
    )
    await expect(canvas.getAllByRole('listitem')[0]).toHaveClass(
      'session-page__queued-message--exit',
    )
    await waitFor(() =>
      expect(
        canvas.getByRole('button', {
          name: 'Steer queued message: Then prepare the release notes.',
        }),
      ).toHaveFocus(),
    )
    await userEvent.click(
      canvas.getByRole('button', {
        name: 'Edit queued message: Then prepare the release notes.',
      }),
    )
    await expect(composer).toHaveTextContent('Then prepare the release notes.')
    await expect(composer).toHaveFocus()
    await userEvent.click(canvas.getByRole('button', { name: 'Finish turn' }))
    await expect(canvas.getByTestId('sent-messages')).toHaveTextContent(
      'Then prepare the release notes.',
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

export const SendsTheChosenSetup: Story = {
  render: () => <SetupComposerStory sessionId="setup-session" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const placeholder = canvas.getAllByText('Direct the next move…')[0]?.getBoundingClientRect()
    const controls = canvas
      .getByRole('button', { name: /^Choose run setup/ })
      .getBoundingClientRect()
    await expect(placeholder?.bottom).toBeLessThanOrEqual(controls.top)
    await userEvent.click(canvas.getByRole('button', { name: /^Choose run setup/ }))
    await userEvent.click(await within(document.body).findByRole('radio', { name: /Sonnet 5/ }))
    await userEvent.keyboard('{Escape}')
    await chooseMode(canvasElement, /Plan/)
    await expect(canvas.getByRole('button', { name: /^Choose run setup/ })).toHaveTextContent(
      'Claude Code·Sonnet 5·Medium',
    )

    await userEvent.click(canvas.getByLabelText('Message'))
    await userEvent.type(canvas.getByLabelText('Message'), 'Plan the migration.')
    await userEvent.keyboard('{Enter}')
    await expect(canvas.getByTestId('sent-messages')).toHaveTextContent(
      'Plan the migration. (sonnet medium plan)',
    )
  },
}

export const QueuedTurnKeepsItsSetup: Story = {
  render: () => <SetupComposerStory running sessionId="queued-setup-session" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')
    const mode = canvas.getByRole('button', { name: /^Choose permission mode/ })

    await chooseMode(canvasElement, /Plan/)
    await userEvent.click(composer)
    await userEvent.type(composer, 'Plan the release.')
    await userEvent.keyboard('{Enter}')
    await chooseMode(canvasElement, /Accept edits/)
    await expect(mode).toHaveTextContent('Accept edits')

    await userEvent.click(
      canvas.getByRole('button', { name: 'Edit queued message: Plan the release.' }),
    )
    await expect(composer).toHaveTextContent('Plan the release.')
    await expect(mode).toHaveTextContent('Plan')

    await chooseMode(canvasElement, /Auto/)
    await userEvent.click(canvas.getByRole('button', { name: 'Finish turn' }))
    await expect(canvas.getByTestId('sent-messages')).toHaveTextContent(
      'Plan the release. (opus medium plan)',
    )
  },
}
