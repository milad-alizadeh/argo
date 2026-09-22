import type { Meta, StoryObj } from '@storybook/react-vite'
import { useRef, useState } from 'react'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { SessionComposer } from '@/domains/sessions/renderer/composer/session-composer'
import { useComposerStore } from '@/domains/sessions/renderer/composer/use-composer-store'
import type { SessionHarness } from '@/domains/sessions/renderer/harness/harnesses'
import { CLAUDE_TURN_SETUP } from '@/domains/sessions/renderer/turn-setup/claude-turn-setup'
import { Button } from '@/platform/renderer/components/ui/button'

const FRAME = 'mx-auto max-w-4xl p-8'
const SETUP_FRAME = 'mx-auto max-w-4xl p-8 pt-96'

// The send chord spelled once, so the stories that only need a draft sent do not each restate it.
// The stories that are about the chord itself press it directly.
async function sendDraft(canvas: ReturnType<typeof within>, draft: string) {
  const composer = canvas.getByLabelText('Message')
  await userEvent.click(composer)
  await userEvent.type(composer, draft)
  await userEvent.keyboard('{Enter}')
  return composer
}

async function chooseMode(canvasElement: HTMLElement, mode: RegExp) {
  await userEvent.click(
    within(canvasElement).getByRole('button', { name: /^Choose permission mode/ }),
  )
  await userEvent.click(await within(document.body).findByRole('menuitemradio', { name: mode }))
  await waitFor(() => expect(within(document.body).queryByRole('menu')).toBeNull())
}

function ManagedComposerStory() {
  const [running, setRunning] = useState(true)

  return (
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
  )
}

function QueuedComposerStory() {
  const [running, setRunning] = useState(true)
  const [sent, setSent] = useState<string[]>([])

  return (
    <>
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
    </>
  )
}

function SteeredQueuedComposerStory() {
  const [steered, setSteered] = useState<string | null>(null)

  return (
    <>
      <SessionComposer
        isRunning
        onSend={async () => true}
        onSteer={async (text) => {
          setSteered(text)
          return true
        }}
        sessionId="steered-queued-session"
      />
      <output data-testid="steered-message">{steered}</output>
    </>
  )
}

function FailedQueuedComposerStory() {
  const [running, setRunning] = useState(true)

  return (
    <>
      <Button onClick={() => setRunning(false)} type="button" variant="outline">
        Finish turn
      </Button>
      <SessionComposer
        isRunning={running}
        onSend={async () => false}
        sessionId="failed-queued-session"
      />
    </>
  )
}

// The send stays pending until the reader finishes it, so a Session switch can land mid-send.
function PendingSendStory() {
  const [sessionId, setSessionId] = useState('session-one')
  const finish = useRef<(sent: boolean) => void>(() => {})

  return (
    <>
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
    </>
  )
}

function NewSessionHarnessestory() {
  const [harness, setHarness] = useState<SessionHarness>('claude')
  const [started, setStarted] = useState<string | null>(null)

  return (
    <>
      <SessionComposer
        harness={{ harness, onChange: setHarness }}
        onSend={async (text) => {
          setStarted(`${harness}: ${text}`)
          return true
        }}
        plan={null}
        sessionId="new:project-one"
      />
      <output className="mt-4 block text-sm" data-testid="started-session">
        {started}
      </output>
    </>
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
    <>
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
        harness={{ harness: 'claude' }}
        setup={{ choices: CLAUDE_TURN_SETUP, value: setup, onChange: setSetup }}
      />
      <output data-testid="sent-messages">{sent.join(' · ')}</output>
    </>
  )
}

const meta = {
  title: 'Sessions/Composer/Turn Lifecycle',
  component: ManagedComposerStory,
  decorators: [
    (Story, { parameters }) => (
      <div className={(parameters.frame as string | undefined) ?? FRAME}>
        <Story />
      </div>
    ),
  ],
  // Drafts outlive a story like they outlive a page, so each story starts from none.
  beforeEach: () => {
    useComposerStore.setState(useComposerStore.getInitialState())
  },
} satisfies Meta<typeof ManagedComposerStory>

export default meta
type Story = StoryObj<typeof ManagedComposerStory>

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
  render: () => <NewSessionHarnessestory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: /^Choose run setup/ })
    await expect(trigger).toHaveAccessibleName('Choose run setup: Claude Code')

    await userEvent.click(trigger)
    await userEvent.click(await within(document.body).findByRole('tab', { name: 'Codex' }))
    await userEvent.keyboard('{Escape}')
    await expect(trigger).toHaveAccessibleName('Choose run setup: Codex')

    await sendDraft(canvas, 'Fix the flaky test.')
    await expect(canvas.getByTestId('started-session')).toHaveTextContent(
      'codex: Fix the flaky test.',
    )
  },
}

export const SendFinishesInAnotherSession: Story = {
  render: () => <PendingSendStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await sendDraft(canvas, 'Sent from session one.')
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

    await sendDraft(canvas, 'Run the focused checks after this Turn.')

    await expect(canvas.getByRole('region', { name: 'Pending Turns' })).toHaveTextContent(
      'Run the focused checks after this Turn.',
    )
    await expect(canvas.getByTestId('sent-messages')).toHaveTextContent('')
    await sendDraft(canvas, 'Then prepare the release notes.')
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

export const SteeredQueuedTurn: Story = {
  render: () => <SteeredQueuedComposerStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const message = 'Steer this queued message.'

    await sendDraft(canvas, message)
    await userEvent.click(canvas.getByRole('button', { name: `Steer queued message: ${message}` }))

    await expect(canvas.getByTestId('steered-message')).toHaveTextContent(message)
    await expect(canvas.queryByRole('listitem')).toBeNull()
    await expect(canvas.getByLabelText('Message')).not.toHaveTextContent(message)
  },
}

export const FailedQueuedTurn: Story = {
  render: () => <FailedQueuedComposerStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await sendDraft(canvas, 'Keep this pending when Claude rejects it.')
    await userEvent.click(canvas.getByRole('button', { name: 'Finish turn' }))
    await expect(canvas.getByRole('region', { name: 'Pending Turns' })).toHaveTextContent(
      'Keep this pending when Claude rejects it.',
    )
  },
}

export const SendsTheChosenSetup: Story = {
  render: () => <SetupComposerStory sessionId="setup-session" />,
  parameters: { frame: SETUP_FRAME },
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
      'Sonnet 5·Medium',
    )

    await sendDraft(canvas, 'Plan the migration.')
    await expect(canvas.getByTestId('sent-messages')).toHaveTextContent(
      'Plan the migration. (sonnet medium plan)',
    )
  },
}

export const QueuedTurnKeepsItsSetup: Story = {
  render: () => <SetupComposerStory running sessionId="queued-setup-session" />,
  parameters: { frame: SETUP_FRAME },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')
    const mode = canvas.getByRole('button', { name: /^Choose permission mode/ })

    await chooseMode(canvasElement, /Plan/)
    await sendDraft(canvas, 'Plan the release.')
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

export const NarrowShowsModelAndEffort: Story = {
  render: () => <SetupComposerStory sessionId="setup-narrow" />,
  parameters: { frame: 'w-(--size-session-feed-min) pt-96' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: /^Choose run setup/ })
    const row = trigger.parentElement

    if (!row) throw new Error('Composer control row is missing.')
    await expect(within(trigger).getByText('Opus 5')).toBeVisible()
    await expect(within(trigger).getByText('Medium')).toBeVisible()
    await expect(within(trigger).queryByText('Claude Code')).not.toBeInTheDocument()
    await expect(trigger).toHaveAccessibleName('Choose run setup: Claude Code, Opus 5, Medium')
    await expect(canvas.getByRole('button', { name: 'Send message' })).toBeVisible()
    await expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth)
  },
}
