import type { Meta, StoryObj } from '@storybook/react-vite'
import { useRef, useState } from 'react'
import { expect, fireEvent, userEvent, waitFor, within } from 'storybook/test'

import type { SessionPlan } from '@/core/sessions/models'
import { Button } from '../../../components/ui/button'
import { BasicFeed } from '../feed/BasicFeed'
import type { SessionCli } from '../harness/harnesses'
import { useComposerStore } from '../state/useComposerStore'
import { CLAUDE_TURN_SETUP } from '../turn-setup/claude-turn-setup'
import type { SessionFeed } from '../types'
import { SessionComposer } from './SessionComposer'

// Files and folders stay on the native attachment path, reached through the shared picker.
async function attachViaMenu(canvas: ReturnType<typeof within>) {
  await userEvent.click(canvas.getByRole('button', { name: 'Add context' }))
  const picker = await within(document.body).findByRole('dialog', { name: 'Context picker' })
  await userEvent.click(within(picker).getByRole('button', { name: 'Files & folders' }))
}

// The send chord spelled once, so the stories that only need a draft sent do not each restate it.
// The stories that are about the chord itself press it directly.
async function sendDraft(canvas: ReturnType<typeof within>, draft: string) {
  const composer = canvas.getByLabelText('Message')
  await userEvent.click(composer)
  await userEvent.type(composer, draft)
  await userEvent.keyboard('{Enter}')
  return composer
}

const FRAME = 'mx-auto max-w-4xl p-8'
const SETUP_FRAME = 'mx-auto max-w-4xl p-8 pt-96'
const CONTEXT_PICKER_FRAME = SETUP_FRAME

const plan: SessionPlan = {
  state: 'available' as const,
  entries: [{ content: 'Choose the base layout', position: 0, status: 'in_progress' as const }],
}

const COMPACTION_FEED = {
  version: 1,
  type: 'session.feed.read',
  requestId: 'storybook-compaction',
  sessionId: 'compacting-session',
  chainId: 'compacting-session',
  revision: 'one',
  rows: [{ shape: 'prose', id: 'prompt', role: 'user', text: 'Condense the Session.' }],
} satisfies SessionFeed

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

const CODEX_REFERENCE_DRAFT =
  'Run `bun run quality` before @argo-plugin reviews it. See [notes](https://example.com/notes).'

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
        onSend={async (text, _setup, attachments) => {
          const refs = attachments.map(({ path }) => `@${path}`).join(' ')
          setSent(refs.length > 0 ? `${text} ${refs}`.trim() : text)
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
function ClosableComposerStory({ cli = 'claude' }: { cli?: SessionCli }) {
  const [open, setOpen] = useState(true)
  const [sent, setSent] = useState<string | null>(null)

  return (
    <>
      <Button onClick={() => setOpen(!open)} type="button" variant="outline">
        {open ? 'Leave the Session' : 'Return to the Session'}
      </Button>
      {open ? (
        <SessionComposer
          harness={{ cli }}
          onSend={async (text) => {
            setSent(text)
            return true
          }}
          sessionId="closable-session"
        />
      ) : null}
      <output className="mt-4 block text-sm" data-testid="sent-message">
        {sent}
      </output>
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

function CompactingComposerStory() {
  const [compacting, setCompacting] = useState(false)

  return (
    <div className="mx-auto flex h-dvh w-full max-w-none flex-col p-8">
      <div className="min-h-0 flex-1">
        <BasicFeed
          activeEvidenceId={null}
          compactionPercentage={compacting ? 22 : null}
          compactionStartedAt={compacting ? '2026-09-13T22:01:00.000Z' : null}
          compactionTokens={compacting ? '10.1k tokens' : null}
          failure={null}
          feed={COMPACTION_FEED}
          onOpenEvidence={() => {}}
          onOpenSession={() => {}}
          onRetryFeed={() => {}}
          onAnswerQuestion={() => {}}
          answeringQuestionId={null}
          questionFailure={() => null}
          isRunning={compacting}
          selectedSessionId="compacting-session"
        />
      </div>
      <SessionComposer
        contextTokens={148_000}
        isCompacting={compacting}
        isRunning={compacting}
        onCompact={async () => {
          setCompacting(true)
          return true
        }}
        onSend={async () => true}
        sessionId="compacting-session"
      />
    </div>
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

function CodexComposerStory() {
  const [sent, setSent] = useState<string | null>(null)

  return (
    <>
      <SessionComposer
        harness={{ cli: 'codex' }}
        onSend={async (text) => {
          setSent(text)
          return true
        }}
        sessionId="codex-session"
      />
      <output className="mt-4 block text-sm" data-testid="sent-message">
        {sent}
      </output>
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

// Stands in for the native chooser, the drop handler's path resolution and the send-time
// readability check, all otherwise reached only through the Electron context bridge.
function mockAttachmentsHost({
  chosenPaths = [],
  readablePaths,
}: {
  chosenPaths?: string[]
  readablePaths?: (paths: string[]) => string[]
} = {}) {
  const before = window.argo
  window.argo = {
    ...before,
    chooseSessionAttachments: async () => ({
      version: 1,
      type: 'session.attachments.chosen',
      requestId: 'storybook-attachments-choose',
      paths: chosenPaths,
    }),
    statSessionAttachments: async ({ paths }) => {
      const readable = new Set(readablePaths ? readablePaths(paths) : paths)
      return {
        version: 1,
        type: 'session.attachments.statted',
        requestId: 'storybook-attachments-stat',
        files: paths.map((path) => ({ path, readable: readable.has(path) })),
      }
    },
    pathForFile: (file) => `/dropped/${file.name}`,
  }
  return () => {
    window.argo = before
  }
}

// The Storybook `play` run happens in a real browser, where `DataTransfer` must be a genuine
// instance: a plain `{ files: [...] }` object throws constructing the DragEvent (#1845).
function fileDataTransfer(names: string[]) {
  const dataTransfer = new DataTransfer()
  for (const name of names) dataTransfer.items.add(new File(['content'], name))
  return dataTransfer
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

export const CompactionStarts: Story = {
  parameters: { frame: 'w-full' },
  render: () => <CompactingComposerStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('button', { name: 'Compact context' }))
    const interrupt = await canvas.findByRole('button', { name: 'Interrupt' })
    await expect(interrupt).toHaveFocus()
    await expect(canvas.getByText('Compacting conversation…')).toBeVisible()
    await expect(canvas.getByText('22%')).toBeVisible()
  },
}

// The sent draft is the mention's own markdown-link syntax, unchanged by the badge it decorates
// as (#2049): the CLI on the other end still reads `[$implement](path)`.
export const SkillMentionSendsItsMarkdown: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')

    await userEvent.click(composer)
    await userEvent.type(composer, '[[$implement](/skills/implement/SKILL.md) go')
    await userEvent.click(canvas.getByRole('button', { name: 'Send message' }))
    await expect(canvas.getByTestId('sent-message')).toHaveTextContent(
      '[$implement](/skills/implement/SKILL.md) go',
    )
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

export const ShiftEnterAddsANewLine: Story = {
  render: () => <UnsettledSendStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')

    await userEvent.click(composer)
    await userEvent.keyboard('Send this once.')
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}')
    await userEvent.keyboard('Then this.')

    await expect(canvas.getByTestId('sent-messages')).toHaveTextContent(/^$/)
    await expect(composer.innerText).toBe('Send this once.\nThen this.')
  },
}

export const EnterSends: Story = {
  render: () => <UnsettledSendStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')

    await userEvent.click(composer)
    await userEvent.keyboard('Send this once.')
    await userEvent.keyboard('{Enter}')

    await expect(canvas.getByTestId('sent-messages')).toHaveTextContent(/^Send this once\.$/)
    await expect(composer.innerText).toBe('Send this once.')
  },
}

export const EnterOnAnEmptyOrWhitespaceComposerSendsNothing: Story = {
  render: () => <UnsettledSendStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')

    await userEvent.click(composer)
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard('   {Enter}')
    await userEvent.keyboard('{Backspace}{Backspace}{Backspace}')
    await userEvent.keyboard('Send this once.{Enter}')

    await expect(canvas.getByTestId('sent-messages')).toHaveTextContent(/^Send this once\.$/)
  },
}

// An Enter that confirms an IME composition belongs to the input method, not to the send, and the
// browser marks that press `isComposing`.
export const EnterConfirmingAnImeCompositionSendsNothing: Story = {
  render: () => <UnsettledSendStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')

    await userEvent.click(composer)
    await userEvent.keyboard('Half a thought.')
    fireEvent.keyDown(composer, { key: 'Enter', isComposing: true })
    await userEvent.keyboard(' The rest of it.{Enter}')

    await expect(canvas.getByTestId('sent-messages')).toHaveTextContent(
      /^Half a thought\. The rest of it\.$/,
    )
  },
}

// The @-reference menu claims Enter ahead of the send: the press that picks a reference is not
// also the press that sends the draft it went into.
export const EnterPicksAReferenceWhileTheMenuIsOpen: Story = {
  render: () => <UnsettledSendStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')

    await userEvent.click(composer)
    await userEvent.type(composer, 'Read @argo')
    const option = await canvas.findByRole('option', { name: /Argo Session plugin/ })
    const menu = option.closest('[role="listbox"]')
    const card = canvasElement.querySelector<HTMLElement>('[data-component="ComposerCard"]')
    if (!menu || !card) throw new Error('Reference menu or Composer card is missing.')
    await expect(menu.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      card.getBoundingClientRect().top,
    )
    await expect(menu.getBoundingClientRect().width).toBeCloseTo(card.getBoundingClientRect().width)
    await userEvent.keyboard('{Enter}')

    await expect(canvas.queryByRole('option')).toBeNull()
    await userEvent.keyboard('{Enter}')
    await expect(canvas.getByTestId('sent-messages')).toHaveTextContent(/^Read @argo-plugin$/)
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

// #1887: a Claude-only reference typed into a Codex Session shows as unsupported, and the exact
// markdown Codex receives is never rewritten to compensate.
export const CodexUnsupportedReferenceIsHonest: Story = {
  render: () => <CodexComposerStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')

    await userEvent.click(composer)
    await userEvent.paste(CODEX_REFERENCE_DRAFT)

    const reference = canvasElement.querySelector('[data-reference="@argo-plugin"]')
    if (!reference) throw new Error('The @argo-plugin reference did not render.')
    await expect(reference).toHaveAttribute('data-unsupported', 'true')
    await expect(reference.querySelector('.sr-only')).toHaveTextContent('— not available for Codex')

    await userEvent.click(canvas.getByRole('button', { name: 'Send message' }))
    await expect(canvas.getByTestId('sent-message')).toHaveTextContent(CODEX_REFERENCE_DRAFT)
  },
}

// #1887: leaving and returning to a Codex Session restores the exact draft, unsupported
// reference included, not a document that lost its honest state along the way.
export const CodexDraftRestoresUnsupportedReference: Story = {
  render: () => <ClosableComposerStory cli="codex" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByLabelText('Message'))
    await userEvent.paste(CODEX_REFERENCE_DRAFT)
    await userEvent.click(canvas.getByRole('button', { name: 'Leave the Session' }))
    await expect(canvas.queryByLabelText('Message')).toBeNull()

    await userEvent.click(canvas.getByRole('button', { name: 'Return to the Session' }))
    await expect(canvas.getByLabelText('Message')).toBeVisible()

    const reference = canvasElement.querySelector('[data-reference="@argo-plugin"]')
    if (!reference) throw new Error('The @argo-plugin reference did not survive restoration.')
    await expect(reference).toHaveAttribute('data-unsupported', 'true')
    await expect(reference.querySelector('.sr-only')).toHaveTextContent('— not available for Codex')

    await userEvent.click(canvas.getByRole('button', { name: 'Send message' }))
    await expect(canvas.getByTestId('sent-message')).toHaveTextContent(CODEX_REFERENCE_DRAFT)
  },
}

export const ReferenceMenuFlagsUnsupportedForCodex: Story = {
  render: () => <CodexComposerStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')

    await userEvent.click(composer)
    await userEvent.type(composer, '@argo')

    const option = await canvas.findByRole('option', { name: /Argo Session plugin/ })
    await expect(option).toHaveTextContent('Not available for Codex')
  },
}

const MARKDOWN_SHORTCUTS: Array<{
  sessionId: string
  type: (composer: HTMLElement) => Promise<unknown>
  assert: (canvas: ReturnType<typeof within>, composer: HTMLElement) => Promise<unknown>
}> = [
  {
    sessionId: 'markdown-heading',
    type: (composer) => userEvent.type(composer, '# Heading'),
    assert: async (canvas) => {
      await expect(canvas.getByRole('heading', { name: 'Heading' })).toBeVisible()
    },
  },
  {
    sessionId: 'markdown-list',
    type: (composer) => userEvent.type(composer, '- First list item'),
    assert: async (canvas) => {
      await expect(canvas.getByRole('list')).toBeVisible()
    },
  },
  {
    sessionId: 'markdown-quote',
    type: (composer) => userEvent.type(composer, '> Quoted detail'),
    assert: async (canvas, composer) => {
      await expect(canvas.getByText('Quoted detail')).toBeVisible()
      await expect(composer.querySelector('blockquote')).not.toBeNull()
    },
  },
  {
    sessionId: 'markdown-inline-code',
    type: (composer) => userEvent.type(composer, '`inline code`'),
    assert: async (canvas) => {
      await expect(canvas.getByText('inline code')).toBeVisible()
    },
  },
  {
    sessionId: 'markdown-code-block',
    type: async (composer) => {
      await userEvent.type(composer, '``')
      await userEvent.keyboard('`')
      await userEvent.type(composer, 'const result = true')
    },
    assert: async (_canvas, composer) => {
      await expect(composer.querySelector(':scope > code')).not.toBeNull()
    },
  },
  {
    sessionId: 'skill-mention-shortcut',
    type: (composer) => userEvent.type(composer, '[[$implement](/skills/implement/SKILL.md)'),
    assert: async (canvas, composer) => {
      await expect(canvas.getByText('Implement')).toBeVisible()
      await expect(composer.querySelector('svg')).not.toBeNull()
      await expect(composer).not.toHaveTextContent('[$implement]')
    },
  },
]

// Each shortcut gets its own composer instance: a shared editor can't be reset to a plain
// paragraph between a list, a blockquote and a code block without racing Lexical's own state.
function MarkdownShortcutsStory() {
  return (
    <>
      {MARKDOWN_SHORTCUTS.map(({ sessionId }) => (
        <SessionComposer key={sessionId} onSend={async () => true} sessionId={sessionId} />
      ))}
    </>
  )
}

export const MarkdownShortcuts: Story = {
  render: () => <MarkdownShortcutsStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composers = canvas.getAllByLabelText('Message')

    for (const [index, { type, assert }] of MARKDOWN_SHORTCUTS.entries()) {
      const composer = composers[index]
      if (!composer) throw new Error(`Expected a composer for shortcut ${index}`)
      await userEvent.click(composer)
      await type(composer)
      await assert(canvas, composer)
    }
  },
}

export const SkillMentionPaste: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')

    await userEvent.click(composer)
    await userEvent.paste('[$implement](/skills/implement/SKILL.md) go')
    await expect(canvas.getByText('Implement')).toBeVisible()
    await expect(composer.querySelector('svg')).not.toBeNull()
    await expect(composer).not.toHaveTextContent('[$implement]')
    await expect(composer).toHaveTextContent('go')
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
      'Claude Code·Sonnet 5·Medium',
    )

    await sendDraft(canvas, 'Plan the migration.')
    await expect(canvas.getByTestId('sent-messages')).toHaveTextContent(
      'Plan the migration. (sonnet medium plan)',
    )
  },
}

export const AttachViaButton: Story = {
  beforeEach: () => mockAttachmentsHost({ chosenPaths: ['/repo/notes.md'] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await attachViaMenu(canvas)
    await expect(await canvas.findByText('notes')).toBeVisible()
    await expect(canvas.getByText('MD file')).toBeVisible()
  },
}

export const SharedContextPicker: Story = {
  parameters: { frame: CONTEXT_PICKER_FRAME },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('button', { name: 'Add context' }))
    const picker = await within(document.body).findByRole('dialog', { name: 'Context picker' })
    await expect(within(picker).getByRole('textbox', { name: 'Search context' })).toHaveFocus()
    await expect(within(picker).getByText('ENG-42')).toBeVisible()
    await expect(within(picker).getByText('Blocked')).toBeVisible()
    await expect(within(picker).queryByText('ENG-9')).toBeNull()
    await expect(within(picker).getByRole('button', { name: /Goals.*Coming soon/ })).toBeDisabled()

    await userEvent.click(within(picker).getByRole('button', { name: /ENG-42.*Keep the Composer/ }))
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-ticket-key="ENG-42"]')).not.toBeNull(),
    )
    await expect(canvas.getByLabelText('Message')).toHaveFocus()
    await userEvent.keyboard('{Backspace}')
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-ticket-key="ENG-42"]')).toBeNull(),
    )

    await userEvent.click(canvas.getByRole('button', { name: 'Add context' }))
    const keyboardPicker = await within(document.body).findByRole('dialog', {
      name: 'Context picker',
    })
    const search = within(keyboardPicker).getByRole('textbox', { name: 'Search context' })
    await expect(search).toHaveFocus()
    await userEvent.type(search, 'ENG-9')
    await expect(within(keyboardPicker).getByText('ENG-9')).toBeVisible()
    await expect(within(keyboardPicker).getByText('Terminal · Done')).toBeVisible()
    await expect(within(keyboardPicker).queryByText('Blocked')).toBeNull()

    await userEvent.click(
      within(keyboardPicker).getByRole('button', { name: /ENG-9.*Store the refresh token/ }),
    )
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-ticket-key="ENG-9"]')).not.toBeNull(),
    )
    await expect(canvas.getByLabelText('Message')).toHaveFocus()
  },
}

export const ImageAttachmentShowsAPreview: Story = {
  beforeEach: () =>
    mockAttachmentsHost({ chosenPaths: ['/repo/notes.md', '/repo/screenshot.png'] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await attachViaMenu(canvas)
    await canvas.findByText('notes')
    await expect(canvas.getByAltText('')).toHaveAttribute('src', 'file:///repo/screenshot.png')
    await expect(canvas.getByText('MD file')).toBeVisible()
    const attachmentGroup = canvasElement.querySelector('[data-slot="attachment-group"]')
    if (attachmentGroup === null) throw new Error('Attachment group did not render')
    await expect(attachmentGroup.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      canvas.getByLabelText('Message').getBoundingClientRect().top,
    )
  },
}

export const RemovingAnAttachmentKeepsTheDraft: Story = {
  beforeEach: () => mockAttachmentsHost({ chosenPaths: ['/repo/notes.md'] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')

    await userEvent.click(composer)
    await userEvent.type(composer, 'Half a thought.')
    await attachViaMenu(canvas)
    await canvas.findByText('notes')
    await userEvent.click(canvas.getByRole('button', { name: 'Remove notes' }))

    await expect(canvas.queryByText('notes')).toBeNull()
    await expect(composer).toHaveTextContent('Half a thought.')
  },
}

export const AttachmentSurvivesASessionSwitch: Story = {
  beforeEach: () => mockAttachmentsHost({ chosenPaths: ['/repo/notes.md'] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await attachViaMenu(canvas)
    await canvas.findByText('notes')
    await userEvent.click(canvas.getByRole('button', { name: 'Session two' }))
    await expect(canvas.queryByText('notes')).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Session one' }))
    await expect(await canvas.findByText('notes')).toBeVisible()
  },
}

export const DragAndDropAttaches: Story = {
  beforeEach: () => mockAttachmentsHost(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')
    const dropTarget = composer.closest('form')?.querySelector('.rounded-xl')

    if (!dropTarget) throw new Error('Composer card is missing.')
    // `fireEvent.drop`'s dataTransfer support copies only the given object's own enumerable
    // properties onto a fresh DataTransfer; a real DataTransfer instance keeps `files`/`items`
    // behind prototype getters, so that copy silently drops them. Dispatch the DragEvent directly
    // instead, with the real DataTransfer attached as the browser constructs it (#1845).
    dropTarget.dispatchEvent(
      new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: fileDataTransfer(['diagram.jpg']),
      }),
    )

    await expect(await canvas.findByText('diagram')).toBeVisible()
    await expect(canvas.getByAltText('')).toHaveAttribute('src', 'file:///dropped/diagram.jpg')
  },
}

export const FailedAttachmentStaysAfterSend: Story = {
  beforeEach: () =>
    mockAttachmentsHost({
      chosenPaths: ['/repo/notes.md', '/repo/gone.md'],
      readablePaths: (paths) => paths.filter((path) => path !== '/repo/gone.md'),
    }),
  render: () => <ComposerStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')

    await userEvent.click(composer)
    await userEvent.type(composer, 'Review these.')
    await attachViaMenu(canvas)
    await canvas.findByText('notes')
    await userEvent.click(canvas.getByRole('button', { name: 'Send message' }))

    await expect(canvas.getByTestId('sent-message')).toHaveTextContent(
      'Review these. @/repo/notes.md',
    )
    await expect(await canvas.findByText('Not found')).toBeVisible()
    await expect(canvas.getByText('gone')).toBeVisible()
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
