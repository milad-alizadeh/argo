import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { MasterDetail } from './MasterDetail'
import { Text } from './Text'

const ITEMS = ['first', 'second', 'third', 'fourth'] as const

const SECTIONS = ITEMS.map((key) => ({
  key,
  detail: (
    <div className="flex h-64 flex-col gap-gap">
      <Text as="h3" variant="row-strong" className="text-foreground">
        {key}
      </Text>
      <Text variant="prose" className="text-foreground-soft">
        One section of the continuous feed. Scrolling flows from here into the next without a click.
      </Text>
    </div>
  ),
}))

// Two runs, which is the shape the feed exists to keep straight: work that belongs to somebody else,
// headed and indented onto its own spine, then the surface's own work back on the root axis.
const GROUPS = [
  {
    key: 'delegated',
    label: 'Delegated',
    count: 'someone else’s work',
    nested: true,
    sections: SECTIONS.slice(0, 2),
  },
  { key: 'own', label: null, sections: SECTIONS.slice(2) },
]

const meta = {
  title: 'Shared/MasterDetail',
  component: MasterDetail,
  parameters: { layout: 'fullscreen' },
  args: { groups: GROUPS },
  argTypes: {
    groups: { control: false, table: { type: { summary: 'MasterDetailGroup[]' } } },
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

/**
 * The interaction model itself: the left list navigates, the right pane is one feed. Clicking a row
 * jumps to its section; scrolling the feed moves the highlight, so the highlight tracks what you are
 * looking at rather than what you last pressed.
 */
export const TwoPane: Story = {
  args: {
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
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const nav = canvas.getByRole('list', { name: 'Sections' })
    await expect(within(nav).getAllByRole('listitem')).toHaveLength(ITEMS.length)
    await userEvent.click(within(nav).getByText('third'))
    await expect(canvas.getByRole('heading', { name: 'third' })).toBeInTheDocument()
    // The delegated run is headed; the root run is not. That asymmetry is the whole seam.
    await expect(canvas.getByText('Delegated')).toBeInTheDocument()
  },
}
