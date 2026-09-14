import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { FeedMermaid } from './FeedMermaid'

const FLOWCHART = 'flowchart LR\n  Backlog --> Ticket --> Session'

const meta: Meta<typeof FeedMermaid> = {
  title: 'Sessions/Feed/Mermaid',
  component: FeedMermaid,
  decorators: [
    (Story) => (
      <div className="max-w-2xl p-6">
        <Story />
      </div>
    ),
  ],
  args: { source: FLOWCHART },
}

export default meta
type Story = StoryObj<typeof FeedMermaid>

export const Drawn: Story = {
  args: { onOpen: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Diagram')).toBeVisible()
    await waitFor(() => expect(canvasElement.querySelector('svg')).not.toBeNull())
    const expand = canvas.getByRole('button', { name: 'Expand diagram in inspector' })
    await userEvent.click(expand)
    await expect(args.onOpen).toHaveBeenCalledTimes(1)
    expand.focus()
    await expect(expand).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await expect(args.onOpen).toHaveBeenCalledTimes(2)
    await userEvent.keyboard(' ')
    await expect(args.onOpen).toHaveBeenCalledTimes(3)
  },
}

export const NoExpand: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => expect(canvasElement.querySelector('svg')).not.toBeNull())
    await expect(
      canvas.queryByRole('button', { name: 'Expand diagram in inspector' }),
    ).not.toBeInTheDocument()
  },
}

export const Active: Story = {
  args: { active: true },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelector('svg')).not.toBeNull())
    const figure = canvasElement.querySelector('figure')
    await expect(figure).toHaveClass('border-primary')
    await expect(figure).toHaveAttribute('aria-current', 'true')
  },
}

export const InvalidSource: Story = {
  args: { source: 'flowchart LR\n  Backlog --> ' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => expect(canvas.getByText('Diagram · Could not render')).toBeVisible())
    const alert = canvas.getByRole('alert')
    await expect(alert).toHaveTextContent('The diagram source is incomplete')
    await expect(alert).toHaveTextContent('The original source remains available above.')
    await expect(canvas.getByText(/Backlog -->/)).toBeVisible()
    await expect(
      canvas.queryByRole('button', { name: 'Expand diagram in inspector' }),
    ).not.toBeInTheDocument()
  },
}

// A wide diagram scrolls inside its own frame rather than being clipped or pushing the Feed wider.
export const NarrowWidth: Story = {
  decorators: [
    (Story) => (
      <div className="w-80 p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    source:
      'flowchart LR\n  Backlog --> Refinement --> Ready --> InProgress --> Review --> Done --> Session',
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelector('svg')).not.toBeNull())
    const frame = canvasElement.querySelector('[aria-busy]')
    await expect(frame).toHaveClass('overflow-x-auto')
  },
}
