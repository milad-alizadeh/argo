import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { expectReachableIn } from '@/mocks/platform/scroll-content-reachability'
import { ScrollArea } from './scroll-area'

const savedEntries = Array.from(
  { length: 16 },
  (_, index) => `Entry ${index + 1}: A saved observation remains available for the next review.`,
)

function SavedEntries({ overflowing = true }) {
  return (
    <div className="grid w-80 gap-4">
      <ScrollArea aria-label="Saved entries" className="h-64" role="region">
        <div className="p-4">
          <button type="button">Read first entry</button>
          <div className="space-y-4 py-4">
            {(overflowing ? savedEntries : savedEntries.slice(0, 1)).map((entry) => (
              <p key={entry}>{entry}</p>
            ))}
          </div>
          <button type="button">Read final entry</button>
        </div>
      </ScrollArea>
      <button type="button">Continue reading</button>
    </div>
  )
}

const meta = {
  title: 'Design System/Primitives/Scroll Area',
  component: ScrollArea,
} satisfies Meta<typeof ScrollArea>

export default meta
type Story = StoryObj<typeof meta>

export const OverflowingContent: Story = {
  render: () => <SavedEntries />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const entries = canvas.getByRole('region', { name: 'Saved entries' })
    await userEvent.click(canvas.getByRole('button', { name: 'Read first entry' }))
    await userEvent.tab()
    const finalEntry = canvas.getByRole('button', { name: 'Read final entry' })
    await expect(finalEntry).toHaveFocus()
    await expectReachableIn(entries, finalEntry)
    await userEvent.tab()
    await expect(canvas.getByRole('button', { name: 'Continue reading' })).toHaveFocus()
  },
}

export const NonoverflowingContent: Story = {
  render: () => <SavedEntries overflowing={false} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const entries = canvas.getByRole('region', { name: 'Saved entries' })
    const firstEntry = canvas.getByRole('button', { name: 'Read first entry' })
    const finalEntry = canvas.getByRole('button', { name: 'Read final entry' })
    await expectReachableIn(entries, firstEntry)
    await expectReachableIn(entries, finalEntry)
    await userEvent.click(firstEntry)
    await userEvent.tab()
    await expect(finalEntry).toHaveFocus()
    await userEvent.tab()
    await expect(canvas.getByRole('button', { name: 'Continue reading' })).toHaveFocus()
  },
}
