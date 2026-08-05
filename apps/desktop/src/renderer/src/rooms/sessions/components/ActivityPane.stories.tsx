import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { activeSection } from '@/shared/components/ui/useScrollSpy'
import {
  FRESH,
  interiorOf,
  interiorOfAgent,
  LONG_SESSION,
  RUNNING,
  WIDE_FANOUT,
} from '../__fixtures__/interior'
import { ActivityPane } from './ActivityPane'

const meta = {
  title: 'Sessions/Activity',
  component: ActivityPane,
  parameters: { layout: 'fullscreen' },
  args: { activity: interiorOf(RUNNING).activity, onSelectAgent: fn() },
  argTypes: { activity: { control: false, table: { type: { summary: 'ActivityModel' } } } },
  // The nav pane sizes off the screen-local `--c-act` its splitter drives.
  decorators: [
    (Story) => (
      <div className="flex h-screen bg-panel" style={{ '--c-act': '420px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ActivityPane>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The whole surface: Subagents above Timeline on the left, ONE agent's continuous feed on the right.
 * This is the story that proves the composition — the two sections are never merged, the feed carries a
 * section per turn in the same order, and the left highlight follows the feed rather than the click.
 */
export const TwoPane: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    // ONCE now, in the nav pane alone: the feed holds one agent's rows, so there is no delegated run
    // for a second heading to head (issue 319).
    await expect(canvas.getAllByText('Subagents')).toHaveLength(1)
    // The nav pane's reading order: delegated work first, then the plan, then this agent's own turns —
    // asserted as an ORDER, the one thing three stacked sections can get wrong while every one of them
    // still renders. `Plan` heads the nav ONCE and only there: the feed's own plan row states the
    // revision in a line rather than re-drawing the list.
    const sections = canvas.getAllByText(/^(Subagents|Plan|Timeline)$/)
    await expect(sections.map((node) => node.textContent)).toEqual([
      'Subagents',
      'Plan',
      'Timeline',
    ])
    // A subagent row SWAPS the pane rather than jumping within it: one pane, one agent.
    const nav = canvas.getByRole('list', { name: 'Subagents' })
    await userEvent.click(within(nav).getByText('security lens'))
    await expect(args.onSelectAgent).toHaveBeenCalledWith('security')
  },
}

/**
 * The pane after the swap: one delegate's own feed, in the same row vocabulary as the root's, with the
 * head naming whose work it is and the way back out of it. The head sits outside the scroller, so
 * neither fact scrolls away from a reader thirty rows down.
 */
export const OneSubagentsFeed: Story = {
  args: { activity: interiorOfAgent(RUNNING, 'correctness').activity },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'correctness lens' })).toBeInTheDocument()
    await userEvent.click(canvas.getByText('back to the session'))
    await expect(args.onSelectAgent).toHaveBeenCalledWith('root')
  },
}

/** The feed's scroller, addressed the way the surface's own code does — by component, not by class. */
const feedOf = (canvasElement: HTMLElement): HTMLElement => {
  const feed = canvasElement.querySelector<HTMLElement>('[data-component="Feed"]')
  if (feed === null) throw new Error('the pane must hold one feed')
  return feed
}

/**
 * Scrolling to a SECTION and to a single tool ROW — the two grains the left list navigates at, and the
 * reason a folded run is one entry: clicking it lands on the one line the feed drew for it.
 */
export const JumpsToSectionAndRow: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const feed = feedOf(canvasElement)
    // The section: the oldest turn's card, which is at the TOP of a feed that opened at its live edge.
    const timeline = canvas.getByRole('list', { name: 'Timeline' })
    const [firstCard] = within(timeline).getAllByRole('button')
    if (firstCard === undefined) throw new Error('the fixture must carry a turn')
    await userEvent.click(firstCard)
    await waitFor(() => expect(feed.scrollTop).toBeLessThan(40), { timeout: 3000 })
    const atTop = feed.scrollTop

    // The row: one step of the LIVE turn, whose own anchor sits further down the feed than the section
    // the jump above landed on — so the feed has to move again, and downward.
    const steps = canvas.getAllByRole('list', { name: 'Tool calls' }).at(-1)
    if (steps === undefined) throw new Error('the live turn must be unfolded with its steps listed')
    const [step] = within(steps).getAllByRole('button')
    if (step === undefined) throw new Error('the live turn must carry a folded row to jump to')
    await userEvent.click(step)
    await waitFor(() => expect(feed.scrollTop).toBeGreaterThan(atTop), { timeout: 3000 })
  },
}

/** One frame, so a scroll the test performed has been laid out before it is measured. */
const frame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()))

/** Every anchor the feed currently holds, in document order. */
const anchorsOf = (feed: HTMLElement): HTMLElement[] => [
  ...feed.querySelectorAll<HTMLElement>('[data-spy]'),
]

/**
 * The scroll-spy over REAL geometry: every anchor the feed can lift to the trip line becomes the
 * current one as the reader scrolls past it, the first turn included.
 *
 * Both halves were broken by a trip line halfway down the pane. The first turn could never be current —
 * by the time its rows reached the middle, the next turn's had crossed too — and a bottomed-out feed
 * answered with its LAST anchor whatever the geometry said, which collapsed the final screenful onto one
 * key and skipped the row before it.
 *
 * The anchors still inside the last screenful at full scroll are excluded, and honestly: there is no
 * scroll left to lift them to the line. Clicking one pins the highlight instead.
 */
export const SpyNamesEveryAnchorItCanReach: Story = {
  play: async ({ canvasElement }) => {
    const feed = feedOf(canvasElement)
    const key = (node: HTMLElement): string => node.getAttribute('data-spy') ?? ''

    feed.scrollTop = feed.scrollHeight
    await frame()
    const line = feed.getBoundingClientRect().top + 24
    const unreachable = new Set(
      anchorsOf(feed)
        .filter((node) => node.getBoundingClientRect().top > line)
        .map(key),
    )

    const seen = new Set<string>()
    const step = 24
    for (let top = 0; top <= feed.scrollHeight; top += step) {
      feed.scrollTop = top
      await frame()
      const named = activeSection(feed, anchorsOf(feed))
      if (named !== null) seen.add(named)
    }

    // The first turn's own section, named while the feed is at its top.
    await expect(seen).toContain('turn:past')
    const missed = anchorsOf(feed)
      .map(key)
      .filter((anchor) => !seen.has(anchor) && !unreachable.has(anchor))
    await expect(missed).toEqual([])
  },
}

/**
 * Forty exchanges — half an hour of work to read back through. Only the sections near the viewport are
 * MOUNTED; the rest stand as spacers of the height they last measured, so reading back through a long
 * session does not stall the window. Every section keeps its anchor either way, which is what lets the
 * window be invisible to the navigation list and the scroll-spy.
 */
export const LongSession: Story = {
  args: { activity: interiorOf(LONG_SESSION).activity },
  play: async ({ canvasElement }) => {
    const anchors = canvasElement.querySelectorAll('[data-spy^="turn:"]')
    await expect(anchors).toHaveLength(40)
    // The proof: far fewer turns MOUNTED than the feed holds anchors for. `TurnFeed` is what a mounted
    // section draws, and the observer reports a frame after mount — hence the wait.
    await waitFor(() =>
      expect(canvasElement.querySelectorAll('[data-component="TurnFeed"]').length).toBeLessThan(10),
    )
    // And the list still lists all forty: the window is the feed's business alone.
    await expect(canvasElement.querySelectorAll('[data-component="TurnRow"]')).toHaveLength(40)
  },
}

/**
 * Thirty subagents beside a live turn — the density the two-pane shape exists for. The list stays
 * narrow and scannable while the detail pane fills the rest with one agent's real feed.
 */
export const WideFanout: Story = { args: { activity: interiorOf(WIDE_FANOUT).activity } }

/**
 * A freshly spawned session has nothing to show, so the surface points at the Dock instead of drawing
 * an empty two-pane with a bare gutter.
 */
export const NothingObserved: Story = {
  args: { activity: interiorOf(FRESH).activity },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/the Dock below is where/)).toBeInTheDocument()
  },
}
