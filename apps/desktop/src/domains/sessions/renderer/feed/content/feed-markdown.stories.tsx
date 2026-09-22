import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { roleColors } from '@/domains/sessions/renderer/feed/content/appearance-probe'
import { FeedMarkdown } from '@/domains/sessions/renderer/feed/content/feed-markdown'
import {
  RICH_MARKDOWN,
  SAMPLE_PICTURE,
} from '@/domains/sessions/renderer/feed/content/feed-samples'

const meta = {
  title: 'Sessions/Feed/Markdown',
  component: FeedMarkdown,
  decorators: [
    (Story) => (
      <div className="max-w-2xl p-6">
        <Story />
      </div>
    ),
  ],
  args: { text: RICH_MARKDOWN },
} satisfies Meta<typeof FeedMarkdown>

export default meta
type Story = StoryObj<typeof FeedMarkdown>

export const Formatted: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('one surface').tagName).toBe('STRONG')
    const heading = canvas.getByRole('heading', { name: 'What changed' })
    await expect(heading).toBeVisible()
    await expect(getComputedStyle(heading).fontWeight).toBe('500')
    const table = canvas.getByRole('table')
    await expect(table).toHaveTextContent('Narrow windowControls stay visiblePassed')
    const [, firstBodyRow] = within(table).getAllByRole('row')
    await expect(getComputedStyle(firstBodyRow ?? table).borderTopWidth).toBe('1px')
    const restored = canvas.getByRole('checkbox', { name: 'Draft restored' })
    await expect(restored).toBeChecked()
    await expect(restored).toHaveAttribute('tabindex', '-1')
    await expect(canvas.getByRole('checkbox', { name: 'Narrow layout review' })).not.toBeChecked()
    const inlineCode = canvas.getByText('editable')
    await expect(inlineCode.tagName).toBe('CODE')
    await expect(getComputedStyle(inlineCode).backgroundColor).toBe(
      roleColors('bg-muted').backgroundColor,
    )
    await expect(getComputedStyle(canvasElement.querySelector('blockquote') ?? table).color).toBe(
      roleColors('text-muted-foreground').color,
    )
    await expect(canvas.getByRole('img', { name: 'TypeScript file' })).toBeVisible()
    await expect(canvas.getByRole('img', { name: 'Code file' })).toBeVisible()
    await expect(canvas.getByRole('separator')).toBeInTheDocument()
  },
}

export const RawHtmlStaysText: Story = {
  args: {
    text: 'Before <script>window.feedHacked = true</script> and <img src="x" onerror="window.feedHacked = true"> after.',
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement).toHaveTextContent('<script>window.feedHacked = true</script>')
    await expect(canvasElement.querySelector('script, img')).toBeNull()
    await expect((window as { feedHacked?: boolean }).feedHacked).toBeUndefined()
  },
}

export const Links: Story = {
  args: {
    text: 'Read [the ticket](https://github.com/milad-alizadeh/argo/issues/1835), [write to us](mailto:reader@example.com), [run this](javascript:alert(1)), [a local note](docs/note.md) or [the report](/repo/docs/report.md).',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const links = canvas.getAllByRole('link')
    await expect(links.map((link) => link.textContent)).toEqual(['the ticket', 'write to us'])
    await expect(canvas.getByRole('link', { name: 'the ticket' })).toHaveAttribute(
      'target',
      '_blank',
    )
    await expect(canvas.getByText('run this').tagName).toBe('SPAN')
    await expect(canvas.getByText('a local note').tagName).toBe('SPAN')
    // With no evidence wiring (a Ticket's description), a file path is text like any other.
    await expect(canvas.getByText('the report').tagName).toBe('SPAN')
  },
}

// An absolute path in an assistant's prose opens that file in the inspector, as a tool's
// evidence does, instead of drawing as dead text.
export const FileLinkOpensEvidence: Story = {
  args: {
    text: 'The complete evidence is in [the report](/repo/docs/report.md), committed as `7f2650ec5`.',
    rowId: 'assistant-1',
    onOpenEvidence: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'the report' }))
    await expect(args.onOpenEvidence).toHaveBeenCalledTimes(1)
    const evidence = (args.onOpenEvidence as ReturnType<typeof fn>).mock.calls[0]?.[0]
    await expect(evidence).toEqual({
      shape: 'file',
      id: 'assistant-1:file:/repo/docs/report.md',
      path: '/repo/docs/report.md',
    })
  },
}

// Tab reaches each link that opens and skips each target drawn as text.
export const LinksFromKeyboard: Story = {
  args: Links.args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.tab()
    await expect(canvas.getByRole('link', { name: 'the ticket' })).toHaveFocus()
    await userEvent.tab()
    await expect(canvas.getByRole('link', { name: 'write to us' })).toHaveFocus()
    await userEvent.tab()
    await expect(canvasElement.contains(document.activeElement)).toBe(false)
  },
}

const DIAGRAM_MARKDOWN = [
  '```mermaid',
  'flowchart LR',
  '  Backlog --> Ticket --> Session',
  '```',
].join('\n')

export const Diagram: Story = {
  args: { text: DIAGRAM_MARKDOWN },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const diagram = canvas.getByRole('figure')
    await waitFor(() => expect(diagram.querySelector('svg')).not.toBeNull(), { timeout: 5000 })
    await expect(diagram).toHaveTextContent('Session')
  },
}

// Expanding a fence's diagram hands the caller the same evidence shape a tool call would.
export const DiagramOpensEvidence: Story = {
  args: { text: DIAGRAM_MARKDOWN, rowId: 'assistant-1', onOpenEvidence: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await waitFor(() => expect(canvasElement.querySelector('figure svg')).not.toBeNull(), {
      timeout: 5000,
    })
    await userEvent.click(canvas.getByRole('button', { name: 'Expand diagram in inspector' }))
    await expect(args.onOpenEvidence).toHaveBeenCalledTimes(1)
    const evidence = (args.onOpenEvidence as ReturnType<typeof fn>).mock.calls[0]?.[0]
    await expect(evidence).toMatchObject({
      shape: 'diagram',
      source: expect.stringContaining('Backlog'),
    })
  },
}

// The fence highlights when its id matches the currently open evidence. The fence's id is
// `${rowId}:diagram:${offset}`, and the diagram is the first character of this fixture, so its
// offset is 0.
export const DiagramActive: Story = {
  args: {
    text: DIAGRAM_MARKDOWN,
    rowId: 'assistant-1',
    activeEvidenceId: 'assistant-1:diagram:0',
    onOpenEvidence: fn(),
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelector('figure svg')).not.toBeNull(), {
      timeout: 5000,
    })
    const figure = canvasElement.querySelector('figure')
    await expect(figure).toHaveAttribute('aria-current', 'true')
  },
}

export const Images: Story = {
  args: {
    text: `Two images in one row:\n\n![The attached reference](${SAMPLE_PICTURE}) ![A file the Session moved](shots/missing.png)\n\nAnd one inside a sentence: ![A second reference](${SAMPLE_PICTURE}) there.`,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const galleries = canvasElement.querySelectorAll('[data-component="FeedGallery"]')
    await expect(galleries).toHaveLength(2)
    await expect(galleries[0]).toHaveTextContent('Image unavailable')
    await waitFor(() =>
      expect(
        canvas.getByRole('button', { name: 'Open The attached reference in lightbox' }),
      ).toHaveAttribute('data-state', 'loaded'),
    )
    await expect(canvasElement.querySelector('p [data-component="FeedGallery"]')).toBeNull()
  },
}
