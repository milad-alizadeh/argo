import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { expect, fireEvent, fn, userEvent, waitFor, within } from 'storybook/test'
import type { ComposerEditing } from '../editing/composer-editing'
import { ComposerForm, type ComposerFormProps } from '../layout/composer-form'
import { ComposerStory, STORY_COMMANDS, STORY_TICKETS } from './composer-story-samples'

const FRAME = 'mx-auto max-w-4xl p-8'

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
const LONG_TICKET_KEY = `ENG-${'REFERENCE-'.repeat(12)}42`

let setComposerOpen: (open: boolean) => void
let landDraft: (afterCommit?: () => void) => void
function ClosableComposerStory({
  harness = 'claude',
  onSend,
}: {
  harness?: 'claude' | 'codex'
  onSend: ComposerFormProps['onSend']
}) {
  const [open, setOpen] = useState(true)
  useEffect(() => {
    setComposerOpen = setOpen
  }, [])
  const [editing, setEditing] = useState<ComposerEditing>()

  return (
    <>
      {open ? (
        <ComposerForm
          harness={{ harness }}
          initialEditing={editing}
          onEditingChange={setEditing}
          onSend={onSend}
          sessionId="closable-session"
        />
      ) : null}
    </>
  )
}

// The send never settles, so the composer keeps its draft while delivery is uncertain.
function UnsettledSendStory({ onSend }: { onSend: ComposerFormProps['onSend'] }) {
  return (
    <ComposerForm
      commands={STORY_COMMANDS}
      onSend={onSend}
      plan={null}
      sessionId="unsettled-session"
    />
  )
}

const LANDED_DRAFT = 'Restored draft'

function DraftLandsStory({ onSend }: { onSend: ComposerFormProps['onSend'] }) {
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    landDraft = (afterCommit) => {
      flushSync(() => setLoading(false))
      // Lexical applies the DOM selection before a subsequent press (#3036).
      if (afterCommit) queueMicrotask(afterCommit)
    }
  }, [])
  return (
    <ComposerForm
      focusOnMount
      initialEditing={loading ? undefined : { prompt: LANDED_DRAFT }}
      loading={loading}
      onSend={onSend}
      sessionId="landing-session"
    />
  )
}

function CodexComposerStory({ onSend }: { onSend: ComposerFormProps['onSend'] }) {
  return (
    <ComposerForm
      harness={{ harness: 'codex' }}
      onSend={onSend}
      sessionId="codex-session"
      tickets={STORY_TICKETS}
    />
  )
}

function LongTicketReferenceStory({ onSend }: { onSend: ComposerFormProps['onSend'] }) {
  return (
    <ComposerForm
      initialEditing={{
        prompt: LONG_TICKET_KEY,
        tickets: [
          {
            id: 'long-ticket',
            provider: 'linear',
            key: LONG_TICKET_KEY,
            title: 'Long provider key',
            status: 'Open',
            terminal: false,
            blocked: null,
          },
        ],
      }}
      onSend={onSend}
      sessionId="long-ticket-reference"
      tickets={[
        {
          provider: 'linear',
          key: LONG_TICKET_KEY,
          title: 'Long provider key',
          status: 'Open',
          terminal: false,
          blocked: null,
        },
      ]}
    />
  )
}

function TicketReferenceStory({ onSend }: { onSend: ComposerFormProps['onSend'] }) {
  return (
    <ComposerForm
      initialEditing={{
        tickets: [
          {
            id: 'ticket-reference',
            provider: 'linear',
            key: 'ENG-42',
            title: 'Keep the Composer draft in sync',
            status: 'In Progress',
            terminal: false,
            blocked: true,
          },
        ],
      }}
      onSend={onSend}
      sessionId="ticket-reference"
      tickets={STORY_TICKETS}
    />
  )
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
        <ComposerForm key={sessionId} onSend={async () => true} sessionId={sessionId} />
      ))}
    </>
  )
}

const meta = {
  title: 'Features/Sessions/Composer/Text Editor',
  component: ComposerStory,
  decorators: [
    (Story, { parameters }) => (
      <div className={(parameters.frame as string | undefined) ?? FRAME}>
        <Story />
      </div>
    ),
  ],
  args: { onSend: fn(async () => true) },
} satisfies Meta<typeof ComposerStory>

export default meta
type Story = StoryObj<typeof ComposerStory>

export const PlainText: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')

    await userEvent.click(composer)
    await userEvent.type(composer, 'Review the new Session shell.')
    await userEvent.click(canvas.getByRole('button', { name: 'Send message' }))
    await expect(args.onSend).toHaveBeenCalledWith('Review the new Session shell.', null, [])
    await expect(composer.textContent).toBe('')
  },
}

// The sent draft is the mention's own markdown-link syntax, unchanged by the badge it decorates
// as (#2049): the Harness on the other end still reads `[$implement](path)`.
export const SkillMentionSendsItsMarkdown: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')

    await userEvent.click(composer)
    await userEvent.type(composer, '[[$implement](/skills/implement/SKILL.md) go')
    await userEvent.click(canvas.getByRole('button', { name: 'Send message' }))
    await expect(args.onSend).toHaveBeenCalledWith(
      '[$implement](/skills/implement/SKILL.md) go',
      null,
      [],
    )
  },
}

export const DraftOutlivesItsComposer: Story = {
  render: (args) => <ClosableComposerStory onSend={args.onSend} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByLabelText('Message'))
    await userEvent.type(canvas.getByLabelText('Message'), 'Half a thought.')
    flushSync(() => setComposerOpen(false))
    await expect(canvas.queryByLabelText('Message')).toBeNull()
    flushSync(() => setComposerOpen(true))
    await expect(canvas.getByLabelText('Message')).toHaveTextContent('Half a thought.')
    await expect(canvas.getByRole('button', { name: 'Send message' })).toBeEnabled()
  },
}

export const ShiftEnterAddsANewLine: Story = {
  render: (args) => <UnsettledSendStory onSend={args.onSend} />,
  args: { onSend: fn(() => new Promise<boolean>(() => {})) },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')

    await userEvent.click(composer)
    await userEvent.keyboard('Send this once.')
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}')
    await userEvent.keyboard('Then this.')

    await expect(args.onSend).not.toHaveBeenCalled()
    await expect(composer.innerText).toBe('Send this once.\nThen this.')
  },
}

export const ShiftEnterContinuesANumberedList: Story = {
  render: (args) => <UnsettledSendStory onSend={args.onSend} />,
  args: { onSend: fn(() => new Promise<boolean>(() => {})) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')

    await userEvent.click(composer)
    await userEvent.type(composer, '1. Hello')
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}')
    await userEvent.keyboard('Second item')

    const items = composer.querySelectorAll('ol > li')
    await expect(items).toHaveLength(2)
    await expect(items[0]).toHaveTextContent('Hello')
    await expect(items[1]).toHaveTextContent('Second item')
  },
}

export const EnterSends: Story = {
  render: (args) => <UnsettledSendStory onSend={args.onSend} />,
  args: { onSend: fn(() => new Promise<boolean>(() => {})) },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')

    await userEvent.click(composer)
    await userEvent.keyboard('Send this once.')
    await userEvent.keyboard('{Enter}')

    await expect(args.onSend).toHaveBeenCalledWith('Send this once.', null, [])
    await expect(composer.innerText).toBe('Send this once.')
  },
}

export const EnterOnAnEmptyOrWhitespaceComposerSendsNothing: Story = {
  render: (args) => <UnsettledSendStory onSend={args.onSend} />,
  args: { onSend: fn(() => new Promise<boolean>(() => {})) },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')

    await userEvent.click(composer)
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard('   {Enter}')
    await userEvent.keyboard('{Backspace}{Backspace}{Backspace}')
    await userEvent.keyboard('Send this once.{Enter}')

    await expect(args.onSend).toHaveBeenCalledTimes(1)
    await expect(args.onSend).toHaveBeenCalledWith('Send this once.', null, [])
  },
}

// No pause between keys: the Enter lands before React renders the typed text (#3020).
export const EnterRightAfterTypingSendsTheTypedText: Story = {
  render: (args) => <UnsettledSendStory onSend={args.onSend} />,
  args: { onSend: fn(() => new Promise<boolean>(() => {})) },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')

    await userEvent.click(composer)
    await userEvent.setup({ delay: null }).keyboard('Send this at once.{Enter}')

    await expect(args.onSend).toHaveBeenCalledTimes(1)
    await expect(args.onSend).toHaveBeenCalledWith('Send this at once.', null, [])
  },
}

// An Enter that confirms an IME composition belongs to the input method, not to the send, and the
// browser marks that press `isComposing`.
export const EnterConfirmingAnImeCompositionSendsNothing: Story = {
  render: (args) => <UnsettledSendStory onSend={args.onSend} />,
  args: { onSend: fn(() => new Promise<boolean>(() => {})) },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')

    await userEvent.click(composer)
    await userEvent.keyboard('Half a thought.')
    fireEvent.keyDown(composer, { key: 'Enter', isComposing: true })
    await userEvent.keyboard(' The rest of it.{Enter}')

    await expect(args.onSend).toHaveBeenCalledTimes(1)
    await expect(args.onSend).toHaveBeenCalledWith('Half a thought. The rest of it.', null, [])
  },
}

// The /-reference menu claims Enter ahead of the send: the press that picks a reference is not
// also the press that sends the draft it went into.
export const EnterPicksASlashReferenceWhileTheMenuIsOpen: Story = {
  render: (args) => <UnsettledSendStory onSend={args.onSend} />,
  args: { onSend: fn(() => new Promise<boolean>(() => {})) },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')

    await userEvent.click(composer)
    await userEvent.type(composer, 'Read /implement')
    const option = await canvas.findByRole('option', { name: /implement/ })
    const menu = option.closest('[role="listbox"]')
    const card = canvasElement.querySelector<HTMLElement>('[data-component="ComposerCard"]')
    if (!menu || !card) throw new Error('Reference menu or Composer card is missing.')
    await expect(menu.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      card.getBoundingClientRect().top,
    )
    await expect(menu.getBoundingClientRect().width).toBeCloseTo(card.getBoundingClientRect().width)
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(canvas.queryByRole('option')).toBeNull())
    await userEvent.keyboard('{Enter}')
    await expect(args.onSend).toHaveBeenCalledWith('Read /implement', null, [])
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

// #1887: a token the command list does not contain stays ordinary text, and the exact markdown
// Codex receives is never rewritten to compensate.
export const CodexUnsupportedReferenceIsHonest: Story = {
  render: (args) => <CodexComposerStory onSend={args.onSend} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')

    await userEvent.click(composer)
    await userEvent.paste(CODEX_REFERENCE_DRAFT)

    await expect(canvasElement.querySelector('[data-reference="@argo-plugin"]')).toBeNull()
    await expect(composer).toHaveTextContent('@argo-plugin')

    await userEvent.click(canvas.getByRole('button', { name: 'Send message' }))
    await expect(args.onSend).toHaveBeenCalledWith(CODEX_REFERENCE_DRAFT, null, [])
  },
}

// #1887: leaving and returning to a Codex Session restores the exact draft, including a token
// that is ordinary text.
export const CodexDraftRestoresUnsupportedReference: Story = {
  render: (args) => <ClosableComposerStory harness="codex" onSend={args.onSend} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByLabelText('Message'))
    await userEvent.paste(CODEX_REFERENCE_DRAFT)
    flushSync(() => setComposerOpen(false))
    await expect(canvas.queryByLabelText('Message')).toBeNull()

    flushSync(() => setComposerOpen(true))
    await expect(canvas.getByLabelText('Message')).toBeVisible()

    await expect(canvasElement.querySelector('[data-reference="@argo-plugin"]')).toBeNull()
    await expect(canvas.getByLabelText('Message')).toHaveTextContent('@argo-plugin')

    await userEvent.click(canvas.getByRole('button', { name: 'Send message' }))
    await expect(args.onSend).toHaveBeenCalledWith(CODEX_REFERENCE_DRAFT, null, [])
  },
}

export const AtTicketQueryShowsTicketsForCodex: Story = {
  render: (args) => <CodexComposerStory onSend={args.onSend} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Add context' }))
    const picker = await within(document.body).findByRole('dialog', { name: 'Context picker' })
    await expect(
      within(picker).getByRole('button', { name: /ENG-42.*Keep the Composer/ }),
    ).toBeVisible()
    await expect(canvas.queryByRole('option')).toBeNull()
  },
}

export const TicketReferenceUsesKeyboardLinkNavigation: Story = {
  render: (args) => <TicketReferenceStory onSend={args.onSend} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')
    const originalUrl = window.location.href

    try {
      await userEvent.click(composer)
      await userEvent.type(composer, 'ENG-42')
      const ticket = await canvas.findByRole('link', { name: 'ENG-42' })
      ticket.focus()
      await expect(ticket).toHaveFocus()

      window.history.replaceState(null, '', '#/projects/story-project/sessions/current')
      await userEvent.keyboard('{Enter}')

      await expect(window.location.hash).toBe('#/projects/story-project/tickets/ENG-42')
      await expect(args.onSend).not.toHaveBeenCalled()
    } finally {
      window.history.replaceState(null, '', originalUrl)
    }
  },
}

export const LongTicketReference: Story = {
  render: (args) => <LongTicketReferenceStory onSend={args.onSend} />,
  play: async ({ canvasElement }) => {
    const reference = canvasElement.querySelector<HTMLElement>('[data-ticket-key]')
    await expect(reference).toHaveAttribute('data-ticket-key', LONG_TICKET_KEY)
    await expect(reference).toHaveAttribute('role', 'link')
  },
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

// Focus asked for on arrival lands with the draft, so it never takes focus back from a later press.
export const PressAsTheDraftLandsKeepsFocus: Story = {
  render: (args) => <DraftLandsStory onSend={args.onSend} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    landDraft(() => canvas.getByRole('button', { name: 'Add context' }).focus())
    const pressed = canvas.getByRole('button', { name: 'Add context' })
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    await expect(canvas.getByRole('combobox', { name: 'Message' })).toHaveTextContent(LANDED_DRAFT)
    await expect(pressed).toHaveFocus()
  },
}

// A landed draft takes focus with the caret after its last character.
export const LandedDraftPutsTheCaretAtTheEnd: Story = {
  render: (args) => <DraftLandsStory onSend={args.onSend} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByRole('combobox', { name: 'Message' })

    landDraft()
    await waitFor(() => expect(composer).toHaveFocus())
    await waitFor(() => expect(composer).toHaveTextContent(LANDED_DRAFT))
    const selection = window.getSelection()
    await expect(selection?.isCollapsed).toBe(true)
    await expect(selection?.anchorNode?.textContent).toBe(LANDED_DRAFT)
    await expect(selection?.anchorOffset).toBe(LANDED_DRAFT.length)
  },
}
