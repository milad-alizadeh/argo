import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { expectReachableIn } from '@/mocks/platform/scroll-content-reachability'

const notes = Array.from(
  { length: 16 },
  (_, index) => `Note ${index + 1}: Keep the saved reading position when the next entry arrives.`,
)
const quotes = Array.from(
  { length: 8 },
  (_, index) => `Quote ${index + 1}: Read this excerpt before returning to the notebook.`,
)

function NativeNotebook({ overflowing = true, nested = false }) {
  return (
    <div className="grid max-w-sm gap-4">
      <section aria-label="Notebook" className="h-64 overflow-y-auto rounded-lg border p-4">
        <button type="button">Read first note</button>
        <div className="space-y-4 py-4">
          {(overflowing ? notes : notes.slice(0, 1)).map((note) => (
            <p key={note}>{note}</p>
          ))}
          {nested ? (
            <section
              aria-label="Quoted notes"
              className="h-40 overflow-y-auto rounded-lg border p-4"
            >
              <button type="button">Read first quote</button>
              <div className="space-y-4 py-4">
                {quotes.map((quote) => (
                  <p key={quote}>{quote}</p>
                ))}
              </div>
              <button type="button">Read final quote</button>
            </section>
          ) : null}
        </div>
        <button type="button">Read final note</button>
      </section>
      <button type="button">Continue reading</button>
    </div>
  )
}

const meta = {
  title: 'App/Appearance/Native Scrollbars',
  component: NativeNotebook,
} satisfies Meta<typeof NativeNotebook>

export default meta
type Story = StoryObj<typeof meta>

export const OverflowingContent: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const notebook = canvas.getByRole('region', { name: 'Notebook' })
    await userEvent.click(canvas.getByRole('button', { name: 'Read first note' }))
    await userEvent.tab()
    const finalNote = canvas.getByRole('button', { name: 'Read final note' })
    await expect(finalNote).toHaveFocus()
    await expectReachableIn(notebook, finalNote, IntersectionObserver)
    await userEvent.tab()
    await expect(canvas.getByRole('button', { name: 'Continue reading' })).toHaveFocus()
  },
}

export const NonoverflowingContent: Story = {
  args: { overflowing: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const notebook = canvas.getByRole('region', { name: 'Notebook' })
    const firstNote = canvas.getByRole('button', { name: 'Read first note' })
    const finalNote = canvas.getByRole('button', { name: 'Read final note' })
    await expectReachableIn(notebook, firstNote, IntersectionObserver)
    await expectReachableIn(notebook, finalNote, IntersectionObserver)
    await userEvent.click(firstNote)
    await userEvent.tab()
    await expect(finalNote).toHaveFocus()
    await userEvent.tab()
    await expect(canvas.getByRole('button', { name: 'Continue reading' })).toHaveFocus()
  },
}

export const NestedContent: Story = {
  args: { nested: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const notebook = canvas.getByRole('region', { name: 'Notebook' })
    const quotes = canvas.getByRole('region', { name: 'Quoted notes' })
    await userEvent.click(canvas.getByRole('button', { name: 'Read first quote' }))
    await userEvent.tab()
    const finalQuote = canvas.getByRole('button', { name: 'Read final quote' })
    await expect(finalQuote).toHaveFocus()
    await expectReachableIn(quotes, finalQuote, IntersectionObserver)
    await expectReachableIn(notebook, finalQuote, IntersectionObserver)
    await userEvent.tab()
    const finalNote = canvas.getByRole('button', { name: 'Read final note' })
    await expect(finalNote).toHaveFocus()
    await expectReachableIn(notebook, finalNote, IntersectionObserver)
    await userEvent.tab()
    await expect(canvas.getByRole('button', { name: 'Continue reading' })).toHaveFocus()
  },
}
