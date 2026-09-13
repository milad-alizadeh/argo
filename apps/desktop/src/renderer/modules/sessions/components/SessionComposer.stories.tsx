import type { Meta, StoryObj } from '@storybook/react'
import { useRef, useState } from 'react'
import { expect, userEvent, within } from 'storybook/test'

import { Button } from '../../../components/ui/button'
import { SessionComposer } from './SessionComposer'

const plan = {
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

function ComposerStory({ className = 'mx-auto max-w-4xl p-8' }: { className?: string }) {
  const [sessionId, setSessionId] = useState('session-one')
  const [sent, setSent] = useState<string | null>(null)

  return (
    <div className={className}>
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
    await userEvent.click(canvas.getByRole('button', { name: 'Send message' }))
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

export const MarkdownHeadingShortcut: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')

    await userEvent.click(composer)
    await userEvent.type(composer, '# Heading')
    await expect(canvas.getByRole('heading', { name: 'Heading' })).toBeVisible()
  },
}

export const MarkdownListShortcut: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')

    await userEvent.click(composer)
    await userEvent.type(composer, '- First list item')
    await expect(canvas.getByRole('list')).toBeVisible()
  },
}

export const MarkdownQuoteShortcut: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')

    await userEvent.click(composer)
    await userEvent.type(composer, '> Quoted detail')
    await expect(canvas.getByText('Quoted detail')).toBeVisible()
    await expect(composer.querySelector('blockquote')).not.toBeNull()
  },
}

export const MarkdownInlineCodeShortcut: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')

    await userEvent.click(composer)
    await userEvent.type(composer, '`inline code`')
    await expect(canvas.getByText('inline code')).toBeVisible()
  },
}

export const MarkdownCodeBlockShortcut: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')

    await userEvent.click(composer)
    await userEvent.type(composer, '``')
    await userEvent.keyboard('`')
    await userEvent.type(composer, 'const result = true')
    await expect(composer.querySelector(':scope > code')).not.toBeNull()
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
  render: () => <ComposerStory className="w-(--size-session-feed-min)" />,
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

export const SendFinishesInAnotherSession: Story = {
  render: () => <PendingSendStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByLabelText('Message'))
    await userEvent.type(canvas.getByLabelText('Message'), 'Sent from session one.')
    await userEvent.keyboard('{Control>}{Enter}{/Control}')
    await userEvent.click(canvas.getByRole('button', { name: 'Session two' }))
    await userEvent.click(canvas.getByLabelText('Message'))
    await userEvent.type(canvas.getByLabelText('Message'), 'Drafted in session two.')
    await userEvent.click(canvas.getByRole('button', { name: 'Finish send' }))
    await expect(canvas.getByLabelText('Message')).toHaveTextContent('Drafted in session two.')
  },
}
