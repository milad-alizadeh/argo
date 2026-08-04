import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { QuietRow } from './QuietRow'

const meta = {
  title: 'Sessions/Activity/QuietRow',
  component: QuietRow,
  args: {
    row: {
      kind: 'quiet',
      key: 'quiet:c1',
      counts: [
        { word: 'read', count: 3 },
        { word: 'searched', count: 1 },
      ],
    },
  },
  argTypes: { row: { control: false, table: { type: { summary: 'QuietRowModel' } } } },
  decorators: [
    (Story) => (
      <div className="w-lg bg-panel p-region">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof QuietRow>

export default meta
type Story = StoryObj<typeof meta>

/** Four calls, one line. The label is arithmetic in Argo's own words, which is what keeps it one line
 * at four calls and at thirty — a host-style sentence degrades into "read a file, read a file, read a
 * file" long before then. */
export const Folded: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('read 3 · searched 1')).toBeInTheDocument()
  },
}

/** A run of one. Still the quiet row rather than a row of its own: a single read is provenance too,
 * and giving it a card would put one glance at a file at the weight of a change to it. */
export const SingleCall: Story = {
  args: { row: { kind: 'quiet', key: 'quiet:c1', counts: [{ word: 'read', count: 1 }] } },
}

/** Thirty of them, which is the case the label exists for. */
export const LongRun: Story = {
  args: {
    row: {
      kind: 'quiet',
      key: 'quiet:c1',
      counts: [
        { word: 'read', count: 18 },
        { word: 'searched', count: 11 },
        { word: 'fetched', count: 1 },
      ],
    },
  },
}
