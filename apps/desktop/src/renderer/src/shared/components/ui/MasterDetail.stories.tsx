import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { FeedAnchor } from './FeedAnchor'
import { MasterDetail } from './MasterDetail'
import { Text } from './Text'

const ITEMS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'] as const

/** One anchor INSIDE a section — the grain a folded feed row navigates at. */
const rowKey = (key: string): string => `${key}:row`

const SECTIONS = ITEMS.map((key) => ({
  key,
  anchors: [rowKey(key)],
  detail: (
    <div className="flex h-64 flex-col gap-gap">
      <Text as="h3" variant="row-strong" className="text-foreground">
        {key}
      </Text>
      <FeedAnchor anchor={rowKey(key)}>
        <Text variant="prose" className="text-foreground-soft">
          One section of the continuous feed. Scrolling flows from here into the next without a
          click.
        </Text>
      </FeedAnchor>
    </div>
  ),
}))

const meta = {
  title: 'Shared/MasterDetail',
  component: MasterDetail,
  parameters: { layout: 'fullscreen' },
  args: { sections: SECTIONS },
  argTypes: {
    sections: { control: false, table: { type: { summary: 'MasterDetailSection[]' } } },
    nav: { control: false, table: { type: { summary: '(api: MasterDetailNav) => ReactNode' } } },
  },
  decorators: [
    (Story) => (
      <div className="flex h-screen bg-panel" style={{ '--c-act': '280px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MasterDetail>

export default meta
type Story = StoryObj<typeof meta>

const NAV: Story['args'] = {
  nav: ({ activeKey, jumpTo }) => (
    <ul aria-label="Sections" className="flex flex-col gap-hair">
      {ITEMS.map((key) => (
        <li key={key}>
          <button
            type="button"
            onClick={() => jumpTo(key)}
            aria-current={key === activeKey ? 'true' : undefined}
            className="w-full cursor-pointer rounded-md px-gap py-tight text-left hover:bg-foreground/4 aria-[current]:bg-primary/10"
          >
            <Text variant="row" className="text-foreground">
              {key}
            </Text>
          </button>
        </li>
      ))}
    </ul>
  ),
}

/**
 * The interaction model itself: the left list navigates, the right pane is one feed. Clicking a row
 * jumps to its section; scrolling the feed moves the highlight, so the highlight tracks what you are
 * looking at rather than what you last pressed.
 */
export const TwoPane: Story = {
  args: NAV,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const nav = canvas.getByRole('list', { name: 'Sections' })
    await expect(within(nav).getAllByRole('listitem')).toHaveLength(ITEMS.length)
    await userEvent.click(within(nav).getByText('third'))
    await expect(canvas.getByRole('heading', { name: 'third' })).toBeInTheDocument()
  },
}

/**
 * A LIVE feed. It opens at its bottom edge and sticks there as rows append; the affordance that takes
 * the edge back appears only once the reader has scrolled up, because nothing reattaches on its own.
 */
export const FollowingTheLiveEdge: Story = {
  args: { ...NAV, feed: { key: 'agent', live: true } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // Attached: there is nothing to reattach to, so the affordance is absent.
    await expect(canvas.queryByText('follow the live edge')).not.toBeInTheDocument()
    // Scrolling up breaks it — here by the jump the nav's first row performs. The smooth scroll it
    // starts lands over several frames, so the affordance is awaited rather than read immediately.
    await userEvent.click(within(canvas.getByRole('list', { name: 'Sections' })).getByText('first'))
    await waitFor(() => expect(canvas.getByText('follow the live edge')).toBeInTheDocument())
  },
}
