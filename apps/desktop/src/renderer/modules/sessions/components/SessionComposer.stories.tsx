import type { Meta, StoryObj } from '@storybook/react-vite'
import { useRef, useState } from 'react'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import type { SessionPlan } from '@/core/sessions/models'
import { Button } from '../../../components/ui/button'
import type { SessionCli } from '../harness/harnesses'
import { useComposerStore } from '../state/useComposerStore'
import { CLAUDE_TURN_SETUP } from '../turn-setup/claude-turn-setup'
import { SessionComposer } from './SessionComposer'

const FRAME = 'mx-auto max-w-4xl p-8'
const SETUP_FRAME = 'mx-auto max-w-4xl p-8 pt-96'

const plan: SessionPlan = {
  state: 'available' as const,
  entries: [{ content: 'Choose the base layout', position: 0, status: 'in_progress' as const }],
}

const RICH_FORMATTING_DRAFT = `# Release notes

The main highlight: **one confirmation** now covers the complete route, with _every step_ shown in context.

## What is new

### Cross-network swaps

- Start with XTZ and choose an asset on another network.
  - Compare route speed before you sign.
  - See the destination fee before the final step.
- [Release notes](https://example.com/release-notes) stay attached to the work.

### Approval flow

1. Review the route.
2. Confirm each required signature.
3. Reopen a settling swap from Activity.

> Keep a small amount of the destination network's native coin for its final step.

Use \`bun run quality\` before handing the work over.

\`\`\`sh
bun run test
bun run quality
\`\`\`

---

Formatting is preserved while you edit.`

function ComposerStory({ plan = null }: { plan?: SessionPlan | null }) {
  const [sessionId, setSessionId] = useState('session-one')
  const [sent, setSent] = useState<string | null>(null)

  return (
    <>
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
        plan={plan}
        sessionId={sessionId}
      />
      <output className="mt-4 block text-sm" data-testid="sent-message">
        {sent}
      </output>
    </>
  )
}

// Closing the composer stands in for leaving the Session page and coming back to it.
function ClosableComposerStory() {
  const [open, setOpen] = useState(true)

  return (
    <>
      <Button onClick={() => setOpen(!open)} type="button" variant="outline">
        {open ? 'Leave the Session' : 'Return to the Session'}
      </Button>
      {open ? <SessionComposer onSend={async () => true} sessionId="closable-session" /> : null}
    </>
  )
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

// The send never settles, so the composer is read before a successful send clears it (#1999).
function UnsettledSendStory() {
  const [sent, setSent] = useState<string[]>([])

  return (
    <>
      <SessionComposer
        onSend={(text) => {
          setSent((current) => [...current, text])
          return new Promise<boolean>(() => {})
        }}
        plan={null}
        sessionId="unsettled-session"
      />
      <output data-testid="sent-messages">{sent.join(' · ')}</output>
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

function NewSessionCliStory() {
  const [cli, setCli] = useState<SessionCli>('claude')
  const [started, setStarted] = useState<string | null>(null)

  return (
    <>
      <SessionComposer
        harness={{ cli, onChange: setCli }}
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
        harness={{ cli: 'claude' }}
        setup={{ choices: CLAUDE_TURN_SETUP, value: setup, onChange: setSetup }}
      />
      <output data-testid="sent-messages">{sent.join(' · ')}</output>
    </>
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
}

export default meta
type Story = StoryObj<typeof ComposerStory>

export const PlainText: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')

    await userEvent.click(composer)
    await userEvent.type(composer, 'Review the new Session shell.')
    await userEvent.click(canvas.getByRole('button', { name: 'Send message' }))
    await expect(canvas.getByTestId('sent-message')).toHaveTextContent(
      'Review the new Session shell.',
    )
    await expect(composer.textContent).toBe('')
  },
}

export const DraftOutlivesItsComposer: Story = {
  render: () => <ClosableComposerStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByLabelText('Message'))
    await userEvent.type(canvas.getByLabelText('Message'), 'Half a thought.')
    await userEvent.click(canvas.getByRole('button', { name: 'Leave the Session' }))
    await expect(canvas.queryByLabelText('Message')).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Return to the Session' }))
    await expect(canvas.getByLabelText('Message')).toHaveTextContent('Half a thought.')
    await expect(canvas.getByRole('button', { name: 'Send message' })).toBeEnabled()
  },
}

export const EnterAddsANewLine: Story = {
  render: () => <UnsettledSendStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')

    await userEvent.click(composer)
    await userEvent.keyboard('Send this once.')
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard('Then this.')

    await expect(canvas.getByTestId('sent-messages')).toHaveTextContent(/^$/)
    await expect(composer.innerText).toBe('Send this once.\n\nThen this.')
  },
}

export const ShiftEnterSends: Story = {
  render: () => <UnsettledSendStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')

    await userEvent.click(composer)
    await userEvent.keyboard('Send this once.')
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}')

    await expect(canvas.getByTestId('sent-messages')).toHaveTextContent(/^Send this once\.$/)
    await expect(composer.innerText).toBe('Send this once.')
  },
}

export const WithPlan: Story = {
  args: { plan },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: 'Open task plan' })

    await userEvent.click(trigger)
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  },
}

export const RichFormatting: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')

    await userEvent.click(composer)
    await userEvent.paste(RICH_FORMATTING_DRAFT)
    await expect(canvas.getByRole('heading', { name: 'Release notes' })).toBeVisible()
    await expect(canvas.getByRole('heading', { name: 'What is new' })).toBeVisible()
    await expect(canvas.getByRole('heading', { name: 'Approval flow' })).toBeVisible()
    await expect(canvas.getAllByRole('list')).toHaveLength(2)
    await expect(canvas.getByRole('link', { name: 'Release notes' })).toBeVisible()
    await expect(canvas.getByText('bun run quality')).toBeVisible()
    await expect(canvas.getByRole('separator')).toBeVisible()
  },
}

function markdownShortcutStory(
  type: (composer: HTMLElement) => Promise<unknown>,
  assert: (canvas: ReturnType<typeof within>, composer: HTMLElement) => Promise<unknown>,
): Story {
  return {
    play: async ({ canvasElement }) => {
      const canvas = within(canvasElement)
      const composer = canvas.getByLabelText('Message')

      await userEvent.click(composer)
      await type(composer)
      await assert(canvas, composer)
    },
  }
}

export const MarkdownHeadingShortcut: Story = markdownShortcutStory(
  (composer) => userEvent.type(composer, '# Heading'),
  async (canvas) => {
    await expect(canvas.getByRole('heading', { name: 'Heading' })).toBeVisible()
  },
)

export const MarkdownListShortcut: Story = markdownShortcutStory(
  (composer) => userEvent.type(composer, '- First list item'),
  async (canvas) => {
    await expect(canvas.getByRole('list')).toBeVisible()
  },
)

export const MarkdownQuoteShortcut: Story = markdownShortcutStory(
  (composer) => userEvent.type(composer, '> Quoted detail'),
  async (canvas, composer) => {
    await expect(canvas.getByText('Quoted detail')).toBeVisible()
    await expect(composer.querySelector('blockquote')).not.toBeNull()
  },
)

export const MarkdownInlineCodeShortcut: Story = markdownShortcutStory(
  (composer) => userEvent.type(composer, '`inline code`'),
  async (canvas) => {
    await expect(canvas.getByText('inline code')).toBeVisible()
  },
)

export const MarkdownCodeBlockShortcut: Story = markdownShortcutStory(
  async (composer) => {
    await userEvent.type(composer, '``')
    await userEvent.keyboard('`')
    await userEvent.type(composer, 'const result = true')
  },
  async (_canvas, composer) => {
    await expect(composer.querySelector(':scope > code')).not.toBeNull()
  },
)

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

export const Narrow: Story = {
  parameters: { frame: 'w-(--size-session-feed-min)' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')
    const composerForm = composer.closest('form')

    if (!composerForm) throw new Error('Session composer form is missing.')
    await userEvent.click(composer)
    await userEvent.type(composer, 'Keep the composer usable at narrow widths.')
    await userEvent.click(canvas.getByRole('button', { name: 'Send message' }))
    await expect(canvas.getByTestId('sent-message')).toHaveTextContent(
      'Keep the composer usable at narrow widths.',
    )
    await expect(composerForm.scrollWidth).toBeLessThanOrEqual(composerForm.clientWidth)
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
    await expect(within(trigger).getByText('Claude Code')).not.toBeVisible()
    await expect(trigger).toHaveAccessibleName('Choose run setup: Claude Code, Opus 5, Medium')
    await expect(canvas.getByRole('button', { name: 'Send message' })).toBeVisible()
    await expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth)
  },
}

export const NewSessionChoosesCli: Story = {
  render: () => <NewSessionCliStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: /^Choose run setup/ })
    await expect(trigger).toHaveAccessibleName('Choose run setup: Claude Code')

    await userEvent.click(trigger)
    await userEvent.click(await within(document.body).findByRole('tab', { name: 'Codex' }))
    await userEvent.keyboard('{Escape}')
    await expect(trigger).toHaveAccessibleName('Choose run setup: Codex')

    await userEvent.click(canvas.getByLabelText('Message'))
    await userEvent.type(canvas.getByLabelText('Message'), 'Fix the flaky test.')
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}')
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
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}')
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
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}')

    await expect(canvas.getByRole('region', { name: 'Pending Turns' })).toHaveTextContent(
      'Run the focused checks after this Turn.',
    )
    await expect(canvas.getByTestId('sent-messages')).toHaveTextContent('')
    await userEvent.click(composer)
    await userEvent.type(composer, 'Then prepare the release notes.')
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}')
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
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}')
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
      'Claude Code·Sonnet 5·Medium',
    )

    await userEvent.click(canvas.getByLabelText('Message'))
    await userEvent.type(canvas.getByLabelText('Message'), 'Plan the migration.')
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}')
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
    await userEvent.click(composer)
    await userEvent.type(composer, 'Plan the release.')
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}')
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
