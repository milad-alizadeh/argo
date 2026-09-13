import type { Meta, StoryObj } from '@storybook/react'
import { useRef, useState } from 'react'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { Button } from '../../../components/ui/button'
import type { SessionCli } from '../hooks/useSessionComposer'
import { ComposerEditor } from './ComposerEditor'
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

function RichDocumentStory({ draft }: { draft: string }) {
  const editorRef = useRef(null)
  const [value, setValue] = useState(draft)
  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="relative overflow-hidden rounded-xl border bg-card">
        <ComposerEditor editorRef={editorRef} draft={value} onChange={setValue} onSend={() => {}} />
      </div>
      <output className="mt-4 block type-body" data-testid="serialized-document">
        {value}
      </output>
    </div>
  )
}

function MarkdownShortcutCase({ name }: { name: string }) {
  const editorRef = useRef(null)
  const [value, setValue] = useState('')
  return (
    <section className="mb-6" data-testid={name}>
      <ComposerEditor editorRef={editorRef} draft={value} onChange={setValue} onSend={() => {}} />
    </section>
  )
}

function MarkdownShortcutMatrixStory() {
  return (
    <div className="mx-auto max-w-4xl p-8">
      <MarkdownShortcutCase name="heading-one" />
      <MarkdownShortcutCase name="heading-two" />
      <MarkdownShortcutCase name="heading-three" />
      <MarkdownShortcutCase name="bullet-list" />
      <MarkdownShortcutCase name="numbered-list" />
      <MarkdownShortcutCase name="quote" />
      <MarkdownShortcutCase name="code-fence" />
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
    await expect(composer).toHaveAttribute('data-keyboard-focus', 'false')
    await userEvent.type(composer, 'Review the new')
    await userEvent.keyboard('{Enter}')
    await userEvent.type(composer, 'Session shell.')
    await expect(composer.querySelectorAll('p')).toHaveLength(2)
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}')
    await expect(canvas.getByTestId('sent-message').textContent).toBe('Review the new\n\nSession shell.')
    await expect(composer.textContent).toBe('')
  },
}

export const ReferenceMenu: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')

    await userEvent.click(composer)
    await userEvent.type(composer, '/')
    await expect(canvas.getByRole('listbox', { name: 'References' })).toBeVisible()
    await expect(canvas.getByRole('option', { name: /Implement/ })).toHaveAttribute(
      'data-reference-kind',
      'command',
    )
    await userEvent.keyboard('{ArrowDown}{Enter}')
    await expect(composer).toHaveTextContent('/grill-me')
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}')
    await expect(canvas.getByTestId('sent-message')).toHaveTextContent('/grill-me')
  },
}

export const SkillReferenceMenu: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')

    await userEvent.click(composer)
    await userEvent.type(composer, '@$front')
    await expect(canvas.getByRole('option', { name: /frontend-design/ })).toHaveAttribute(
      'data-reference-kind',
      'skill',
    )
  },
}

export const EscapeKeepsReferenceText: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')

    await userEvent.click(composer)
    await userEvent.type(composer, '/imp')
    await userEvent.keyboard('{Escape}')
    await expect(composer).toHaveTextContent('/imp')
    await expect(canvas.queryByRole('listbox', { name: 'References' })).toBeNull()
  },
}

export const FilteredFileReferenceMenu: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')

    await userEvent.click(composer)
    await userEvent.type(composer, '@agent')
    await expect(canvas.getByRole('option', { name: /AGENTS.md/ })).toBeVisible()
    await userEvent.keyboard('{Enter}')
    await expect(composer).toHaveTextContent('@AGENTS.md ')
  },
}

export const MarkdownDocument: Story = {
  render: () => (
    <RichDocumentStory
      draft={
        '# Heading\n\n- A list item\n\n> A quote\n\n```ts\nconst answer = 42\n```\n\n[Argo](https://argo.example) and `inline` **bold** *italic* ~~struck~~'
      }
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const heading = canvas.getByRole('heading', { level: 1, name: 'Heading' })
    await expect(heading).toBeVisible()
    await expect(getComputedStyle(heading).fontSize).toBe('20px')
    await expect(getComputedStyle(heading).fontWeight).toBe('600')
    await expect(canvas.getByRole('listitem')).toHaveTextContent('A list item')
    await expect(canvas.getByText('A quote')).toBeVisible()
    await expect(canvas.getByText('const answer = 42')).toBeVisible()
    await expect(canvas.getByRole('link', { name: 'Argo' })).toHaveAttribute(
      'href',
      'https://argo.example',
    )
    await expect(canvas.getByTestId('serialized-document')).toHaveTextContent('**bold**')
    await expect(canvas.getByTestId('serialized-document')).toHaveTextContent('~~struck~~')
  },
}

export const MarkdownShortcuts: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')

    await userEvent.click(composer)
    await userEvent.type(composer, '# ')
    await userEvent.type(composer, 'Heading')
    await expect(canvas.getByRole('heading', { level: 1, name: 'Heading' })).toBeVisible()
    await userEvent.keyboard('{Enter}')
    await userEvent.type(composer, '- ')
    await userEvent.type(composer, 'List item')
    await expect(canvas.getByRole('listitem')).toHaveTextContent('List item')
  },
}

export const MarkdownShortcutMatrix: Story = {
  render: () => <MarkdownShortcutMatrixStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const typeShortcut = async (name: string, source: string, content: string) => {
      const composer = within(canvas.getByTestId(name)).getByLabelText('Message')
      await userEvent.click(composer)
      await userEvent.type(composer, source)
      if (content) await userEvent.type(composer, content)
      return composer
    }

    await typeShortcut('heading-one', '# ', 'Heading one')
    await expect(canvas.getByRole('heading', { level: 1, name: 'Heading one' })).toBeVisible()

    await typeShortcut('heading-two', '## ', 'Heading two')
    await expect(canvas.getByRole('heading', { level: 2, name: 'Heading two' })).toBeVisible()

    await typeShortcut('heading-three', '### ', 'Heading three')
    await expect(canvas.getByRole('heading', { level: 3, name: 'Heading three' })).toBeVisible()

    await typeShortcut('bullet-list', '* ', 'Bullet item')
    await expect(within(canvas.getByTestId('bullet-list')).getByRole('listitem')).toHaveTextContent(
      'Bullet item',
    )

    await typeShortcut('numbered-list', '1. ', 'Numbered item')
    await expect(within(canvas.getByTestId('numbered-list')).getByRole('listitem')).toHaveTextContent(
      'Numbered item',
    )

    await typeShortcut('quote', '> ', 'Quoted text')
    await expect(within(canvas.getByTestId('quote')).getByText('Quoted text')).toBeVisible()

    const codeComposer = await typeShortcut('code-fence', '```', '')
    await expect(codeComposer.querySelector('code')).toBeVisible()
    await userEvent.type(codeComposer, 'const answer = 42')
    await expect(within(canvas.getByTestId('code-fence')).getByText('const answer = 42')).toBeVisible()
  },
}

export const MarkdownInlineShortcuts: Story = {
  render: () => <RichDocumentStory draft="" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')

    await userEvent.click(composer)
    await userEvent.type(composer, '**bold** *italic* ~~struck~~ `inline`')

    await expect(composer.querySelector('strong')).toHaveTextContent('bold')
    await expect(composer.querySelector('em')).toHaveTextContent('italic')
    await expect(composer.querySelector('code')).toHaveTextContent('inline')
    await expect(canvas.getByTestId('serialized-document')).toHaveTextContent('~~struck~~')
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
