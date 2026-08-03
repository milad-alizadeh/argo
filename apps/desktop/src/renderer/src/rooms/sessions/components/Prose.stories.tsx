import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Prose } from './Prose'

const meta = {
  title: 'Sessions/Activity/TurnFeed/Prose',
  component: Prose,
  args: {
    markdown:
      'Line 444 closes `#list` but I labelled it as closing `.railrest`. That is **wrong** and the fix is *small*, so I took it — see [the ticket](https://example.test/315).',
  },
  argTypes: { markdown: { control: 'text' } },
  decorators: [
    (Story) => (
      <div className="w-lg bg-panel p-region text-foreground-soft">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Prose>

export default meta
type Story = StoryObj<typeof meta>

/** The reason this ticket exists: identifiers set as code inside an ordinary sentence, so the
 * names a paragraph is about read as names rather than as punctuation. */
export const Sentence: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('#list')).toBeInTheDocument()
    await expect(canvas.getByText('wrong')).toBeInTheDocument()
    // A link opens in the browser, never in the window — `target="_blank"` is what routes it
    // through main's window-open handler rather than navigating the cockpit away from itself.
    const link = canvas.getByRole('link', { name: 'the ticket' })
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(link).toHaveAttribute('rel', 'noreferrer noopener')
  },
}

/** A fenced block with its language named, which is how a diff or a snippet arrives in agent
 * prose. Its whitespace is the code's, so it scrolls rather than rewraps. */
export const FencedBlock: Story = {
  args: {
    markdown:
      'The rail rule reads:\n\n```css\n#list > .railrest {\n  border-left: 1px solid var(--inset-hair);\n}\n```',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('css')).toBeInTheDocument()
    await expect(canvas.getByText(/border-left/)).toBeInTheDocument()
  },
}

/** Both list kinds — the shape agent prose reaches for whenever it enumerates anything. */
export const Lists: Story = {
  args: {
    markdown:
      'Two things went wrong:\n\n- the rail was measured from the wrong edge\n- the label named the wrong selector\n\nSo, in order:\n\n1. re-measure\n2. relabel\n3. re-run the story tests',
  },
}

/** Everything the subset refuses, shown as the characters the agent wrote. Nothing is dropped and
 * nothing leaks as markup: a heading stays `##`, a table stays pipes, an image stays its source. */
export const ExcludedSyntax: Story = {
  args: {
    markdown:
      '## Rotation plan\n\n| step | owner |\n| --- | --- |\n| rotate | me |\n\n![diagram](https://elsewhere.test/plan.png)\n\n> quoted\n\nand a written-out <b>tag</b>',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/## Rotation plan/)).toBeInTheDocument()
    await expect(canvas.getByText(/\| step \| owner \|/)).toBeInTheDocument()
    await expect(canvas.getByText(/!\[diagram\]/)).toBeInTheDocument()
    await expect(canvas.getByText(/<b>tag<\/b>/)).toBeInTheDocument()
    // The excluded elements are never built, so there is nothing to have filtered.
    await expect(canvasElement.querySelector('h2, table, img, blockquote, b')).toBeNull()
  },
}

/** Markup the agent left half-finished — an unclosed fence, a lone backtick. It reads as the text
 * it is, and the paragraph after it still arrives. */
export const MalformedMarkup: Story = {
  args: {
    markdown:
      'a ` lonely backtick and a **dangling bold\n\n```ts\nconst unterminated = true\n\nthe row continues',
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/the row continues/)).toBeInTheDocument()
  },
}

/** A destination this app will not open loses its href and keeps its words — the link is inert
 * rather than absent, so the reader still sees what the agent wrote. */
export const UnbrowsableLink: Story = {
  args: { markdown: 'try [this](javascript:alert(1)) and [that](file:///etc/passwd)' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('this')).toBeInTheDocument()
    await expect(canvas.queryByRole('link')).not.toBeInTheDocument()
  },
}
