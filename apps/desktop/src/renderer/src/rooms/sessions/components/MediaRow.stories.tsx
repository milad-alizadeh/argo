import type { MediaRowModel } from '@shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { aMediaResult as media, type ShotStage, aShotOf as shot } from '../__fixtures__/media'
import { MediaRow } from './MediaRow'

const row = (over: Partial<MediaRowModel> = {}): MediaRowModel => ({
  kind: 'media',
  key: 'media:shot-1',
  subject: '/tmp/argo-shots/cockpit-after.png',
  status: 'completed',
  media: media(),
  open: true,
  ...over,
})

const meta = {
  title: 'Sessions/Activity/MediaRow',
  component: MediaRow,
  args: { row: row() },
  argTypes: { row: { control: false, table: { type: { summary: 'MediaRowModel' } } } },
  decorators: [
    (Story) => (
      <div className="w-2xl bg-panel p-region">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MediaRow>

export default meta
type Story = StoryObj<typeof meta>

/** The bytes the agent actually looked at, embedded in the record and shown without a click. No
 * caveat under it: these pixels ARE what it saw, and no later edit to the file can change that. */
export const Embedded: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('img')).toBeInTheDocument()
    await expect(canvas.queryByText(/not necessarily what the agent saw/)).not.toBeInTheDocument()
  },
}

/** The fallback: the record embedded nothing, so the file was re-read from disk. Labelled, because
 * the same filename after three renders is very often not the same picture — and the label sits ABOVE
 * the image, since a caveat read after you have looked is a caveat that arrived too late. */
export const FromDisk: Story = {
  args: {
    row: row({
      media: media({ tier: 'derived', bytes: shot('the file on disk NOW', 'second') }),
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/not necessarily what the agent saw/)).toBeInTheDocument()
    await expect(canvas.getByRole('img')).toBeInTheDocument()
  },
}

/** Nothing to show: the record declared an image and carried no readable bytes. An honest line, never
 * the browser's broken-image glyph. */
export const Undecodable: Story = {
  args: { row: row({ media: media({ bytes: null }) }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/carried no readable bytes/)).toBeInTheDocument()
    await expect(canvas.queryByRole('img')).not.toBeInTheDocument()
  },
}

/** The file is gone. The agent DID look at a picture, so the row stays and says the picture cannot be
 * shown — a folded read line would be silent about it instead. */
export const FileGone: Story = {
  args: { row: row({ media: media({ tier: 'derived', bytes: null }) }) },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(/missing, deleted, or unreadable/),
    ).toBeInTheDocument()
  },
}

/** Past the decode bound. Older shots keep their frame, their path and their affordance and decode
 * when asked — a turn that took thirty full-window screenshots must not hold thirty bitmaps. */
export const DecodeOnDemand: Story = {
  args: { row: row({ open: false }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('img')).not.toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: /show image/ }))
    await expect(canvas.getByRole('img')).toBeInTheDocument()
  },
}

/** The call broke and still returned what it had looked at. The picture is the fact worth showing, so
 * it stays — and the ring is what stops the row reading as an ordinary successful look. */
export const Failed: Story = {
  args: { row: row({ status: 'failed' }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('failed')).toBeInTheDocument()
    await expect(canvas.getByRole('img')).toBeInTheDocument()
  },
}

/** Three reads of ONE path within a turn, which is what a visual debugging loop looks like: each row
 * shows its own bytes, so the differences the agent was chasing are on screen in order. */
const STAGES: readonly [string, ShotStage][] = [
  ['first render', 'first'],
  ['after the fix', 'second'],
  ['after the second fix', 'third'],
]

export const SamePathThrice: Story = {
  render: () => (
    <div className="flex flex-col gap-region">
      {STAGES.map(([label, stage], index) => (
        <MediaRow
          key={stage}
          row={row({ key: `media:shot-${index}`, media: media({ bytes: shot(label, stage) }) })}
        />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const images = within(canvasElement).getAllByRole('img')

    await expect(images).toHaveLength(3)
    await expect(new Set(images.map((image) => image.getAttribute('src'))).size).toBe(3)
  },
}
