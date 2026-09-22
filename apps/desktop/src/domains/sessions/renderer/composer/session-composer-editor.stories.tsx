import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fireEvent, userEvent, waitFor, within } from 'storybook/test'
import { Button } from '@/platform/renderer/components/ui/button'
import { ComposerStory } from './composer-story-samples'
import { SessionComposer } from './session-composer'
import { useComposerStore } from './use-composer-store'

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

// Closing the composer stands in for leaving the Session page and coming back to it.
function ClosableComposerStory({ harness = 'claude' }: { harness?: 'claude' | 'codex' }) {
  const [open, setOpen] = useState(true)
  const [sent, setSent] = useState<string | null>(null)

  return (
    <>
      <Button onClick={() => setOpen(!open)} type="button" variant="outline">
        {open ? 'Leave the Session' : 'Return to the Session'}
      </Button>
      {open ? (
        <SessionComposer
          harness={{ harness }}
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

// The send never settles, so the composer keeps its draft while delivery is uncertain.
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

function CodexComposerStory() {
  const [sent, setSent] = useState<string | null>(null)

  return (
    <>
      <SessionComposer
        harness={{ harness: 'codex' }}
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

const meta = {
  title: 'Sessions/Composer/Text Editor',
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
} satisfies Meta<typeof ComposerStory>

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

// The sent draft is the mention's own markdown-link syntax, unchanged by the badge it decorates
// as (#2049): the Harness on the other end still reads `[$implement](path)`.
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

export const ShiftEnterContinuesANumberedList: Story = {
  render: () => <UnsettledSendStory />,
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

// The /-reference menu claims Enter ahead of the send: the press that picks a reference is not
// also the press that sends the draft it went into.
export const EnterPicksASlashReferenceWhileTheMenuIsOpen: Story = {
  render: () => <UnsettledSendStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')

    await userEvent.click(composer)
    await userEvent.type(composer, 'Read /implement')
    const option = await canvas.findByRole('option', { name: /Implement/ })
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
    await expect(canvas.getByTestId('sent-messages')).toHaveTextContent(/^Read \/implement$/)
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
  render: () => <ClosableComposerStory harness="codex" />,
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

export const AtTicketQueryShowsTicketsForCodex: Story = {
  render: () => <CodexComposerStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')

    await userEvent.click(composer)
    await userEvent.type(composer, '@ENG')

    const picker = await canvas.findByRole('dialog', { name: 'Context picker' })
    await expect(
      within(picker).getByRole('button', { name: /ENG-42.*Keep the Composer/ }),
    ).toBeVisible()
    await expect(canvas.queryByRole('option')).toBeNull()
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
