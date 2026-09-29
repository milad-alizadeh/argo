import type { Meta, StoryObj } from '@storybook/react-vite'
import { useRef, useState } from 'react'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { claudeComposerModelCatalogFixture } from '@/mocks/sessions/claude-model-catalog.fixture'
import { claudeChoices } from '@/mocks/sessions/harness-catalog.fixture'
import { Button } from '@/platform/renderer/components/ui/button'
import type { SessionHarness } from '../../harness/harnesses'
import { ComposerForm, type ComposerFormProps } from '../layout/composer-form'
import type { TurnConfigurationChoices } from '../turn-configuration/turn-configuration'
import { configurationFromReading } from '../turn-configuration/turn-configuration'

const CLAUDE_TURN_CONFIGURATION = (() => {
  const choices = claudeChoices(claudeComposerModelCatalogFixture())
  if (choices === null) throw new Error('The Claude story catalog has no usable model.')
  return choices
})() satisfies TurnConfigurationChoices

const FRAME = 'mx-auto max-w-4xl p-8'
const TURN_CONFIGURATION_FRAME = 'mx-auto max-w-4xl p-8 pt-96'

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

function LiveComposerStory() {
  const [running, setRunning] = useState(true)

  return (
    <ComposerForm
      isRunning={running}
      onInterrupt={async () => {
        setRunning(false)
        return true
      }}
      onSend={async () => false}
      plan={null}
      sessionId="live-session"
    />
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
      <ComposerForm
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

function NewSessionHarnessestory({ onSend }: { onSend: ComposerFormProps['onSend'] }) {
  const [harness, setHarness] = useState<SessionHarness>('claude')

  return (
    <ComposerForm
      harness={{ harness, onChange: setHarness }}
      onSend={onSend}
      plan={null}
      sessionId="new:project-one"
    />
  )
}

function TurnConfigurationComposerStory({
  onSend,
  running = false,
  sessionId,
}: {
  onSend: ComposerFormProps['onSend']
  running?: boolean
  sessionId: string
}) {
  const [isRunning, setRunning] = useState(running)
  const [turnConfiguration, setTurnConfiguration] = useState(CLAUDE_TURN_CONFIGURATION.opening)

  return (
    <>
      <Button onClick={() => setRunning(false)} type="button" variant="outline">
        Finish turn
      </Button>
      <ComposerForm
        isRunning={isRunning}
        onSend={onSend}
        sessionId={sessionId}
        harness={{ harness: 'claude' }}
        turnConfiguration={{
          choices: CLAUDE_TURN_CONFIGURATION,
          value: turnConfiguration,
          onChange: setTurnConfiguration,
        }}
      />
    </>
  )
}

function HistoricalResolvedModelStory({ onSend }: { onSend: ComposerFormProps['onSend'] }) {
  const [turnConfiguration, setTurnConfiguration] = useState(() =>
    configurationFromReading(CLAUDE_TURN_CONFIGURATION, {
      model: 'claude-sonnet-4-5',
      effort: 'medium',
      mode: 'default',
    }),
  )

  return (
    <ComposerForm
      onSend={onSend}
      sessionId="historical-sonnet-session"
      harness={{ harness: 'claude' }}
      turnConfiguration={{
        choices: CLAUDE_TURN_CONFIGURATION,
        value: turnConfiguration,
        onChange: setTurnConfiguration,
      }}
    />
  )
}

const meta = {
  title: 'Sessions/Composer/Turn Lifecycle',
  component: LiveComposerStory,
  decorators: [
    (Story, { parameters }) => (
      <div className={(parameters.frame as string | undefined) ?? FRAME}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LiveComposerStory>

export default meta
type Story = StoryObj<typeof LiveComposerStory>

export const RunningTurn: Story = {
  render: () => <LiveComposerStory />,
  tags: ['view-only'],
}

export const LiveTurn: Story = {
  render: () => <LiveComposerStory />,
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

export const NewSessionChoosesCli: StoryObj<typeof NewSessionHarnessestory> = {
  render: (args) => <NewSessionHarnessestory {...args} />,
  args: { onSend: fn(async () => true) },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: /^Choose Turn configuration/ })
    await expect(trigger).toHaveAccessibleName('Choose Turn configuration: Claude Code')

    await userEvent.click(trigger)
    await userEvent.click(await within(document.body).findByRole('tab', { name: 'Codex' }))
    await userEvent.keyboard('{Escape}')
    await expect(trigger).toHaveAccessibleName('Choose Turn configuration: Codex')

    await sendDraft(canvas, 'Fix the flaky test.')
    await expect(args.onSend).toHaveBeenCalledWith('Fix the flaky test.', null, [])
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

export const RunningSessionSendUsesDurableCommand: StoryObj<typeof TurnConfigurationComposerStory> =
  {
    render: (args) => (
      <TurnConfigurationComposerStory {...args} running sessionId="running-session-send" />
    ),
    args: { onSend: fn(async () => true) },
    play: async ({ args, canvasElement }) => {
      const canvas = within(canvasElement)
      const composer = canvas.getByLabelText('Message')
      await sendDraft(canvas, 'Keep this Turn in the durable draft flow.')
      await expect(args.onSend).toHaveBeenCalledWith(
        'Keep this Turn in the durable draft flow.',
        CLAUDE_TURN_CONFIGURATION.opening,
        [],
      )
      await expect(composer).not.toHaveTextContent('Keep this Turn in the durable draft flow.')
    },
  }

export const SendsTheChosenTurnConfiguration: StoryObj<typeof TurnConfigurationComposerStory> = {
  render: (args) => (
    <TurnConfigurationComposerStory {...args} sessionId="turnConfiguration-session" />
  ),
  args: { onSend: fn(async () => true) },
  parameters: { frame: TURN_CONFIGURATION_FRAME },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /^Choose Turn configuration/ }))
    await userEvent.click(await within(document.body).findByRole('radio', { name: /Sonnet 5/ }))
    await userEvent.keyboard('{Escape}')
    await chooseMode(canvasElement, /Plan/)
    await expect(
      canvas.getByRole('button', { name: /^Choose Turn configuration/ }),
    ).toHaveTextContent('Sonnet 5·Medium')

    await sendDraft(canvas, 'Plan the migration.')
    await expect(args.onSend).toHaveBeenCalledWith(
      'Plan the migration.',
      { model: 'sonnet', effort: 'medium', mode: 'plan' },
      [],
    )
  },
}

export const NarrowShowsModelAndEffort: StoryObj<typeof TurnConfigurationComposerStory> = {
  render: (args) => (
    <TurnConfigurationComposerStory {...args} sessionId="turnConfiguration-narrow" />
  ),
  args: { onSend: fn(async () => true) },
  parameters: { frame: 'w-(--size-session-feed-min) pt-96' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: /^Choose Turn configuration/ })
    const row = trigger.parentElement

    if (!row) throw new Error('Composer control row is missing.')
    await expect(within(trigger).getByText('Opus 5')).toBeVisible()
    await expect(within(trigger).getByText('Medium')).toBeVisible()
    await expect(within(trigger).queryByText('Claude Code')).not.toBeInTheDocument()
    await expect(trigger).toHaveAccessibleName(
      'Choose Turn configuration: Claude Code, Opus 5, Medium',
    )
    await expect(canvas.getByRole('button', { name: 'Send message' })).toBeVisible()
    await expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth)
  },
}

export const HistoricalSonnetIdKeepsSonnet: StoryObj<typeof HistoricalResolvedModelStory> = {
  render: (args) => <HistoricalResolvedModelStory {...args} />,
  args: { onSend: fn(async () => true) },
  parameters: { frame: TURN_CONFIGURATION_FRAME },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const turnConfiguration = canvas.getByRole('button', { name: /^Choose Turn configuration/ })

    await expect(turnConfiguration).toHaveTextContent('Sonnet 5')
    await userEvent.click(turnConfiguration)
    await expect(
      await within(document.body).findByRole('radio', { name: /Sonnet 5/ }),
    ).toBeChecked()
  },
}
