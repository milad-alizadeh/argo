import type { QuietCallModel } from '@shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { QuietRow } from './QuietRow'

const ROOT = '/Users/me/argo/.claude/worktrees/ticket-318'

const FILES = [
  'apps/desktop/src/shared/feedRows.ts',
  'apps/desktop/src/shared/feedCalls.ts',
  'apps/desktop/src/main/observe/tree.ts',
]

const reads: QuietCallModel[] = FILES.map((target, index) => ({
  key: `quiet-call:r${index}`,
  word: 'read',
  target,
  isPath: true,
  callKind: 'read',
  status: 'completed',
  output: null,
}))

const searched: QuietCallModel = {
  key: 'quiet-call:s1',
  word: 'searched',
  target: 'turnFeedRows',
  isPath: false,
  callKind: 'search',
  status: 'completed',
  output: null,
}

const many = (word: string, count: number, from: number): QuietCallModel[] =>
  Array.from({ length: count }, (_, index) => ({
    key: `quiet-call:${from + index}`,
    word,
    target: `${FILES[index % FILES.length]}`,
    isPath: true,
    callKind: 'read',
    status: 'completed',
    output: null,
  }))

const meta = {
  title: 'Sessions/Activity/QuietRow',
  component: QuietRow,
  args: {
    row: {
      kind: 'quiet',
      observed: true,
      key: 'quiet:c1',
      counts: [
        { word: 'read', count: 3 },
        { word: 'searched', count: 1 },
      ],
      calls: [...reads, searched],
    },
    // The session's own working directory. Every path on the feed is shown relative to it, so a
    // story without one would render the absolute paths the surface exists to stop repeating.
    root: ROOT,
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
    await expect(
      within(canvasElement).getByText(/Read 3 files, searched 1 pattern/),
    ).toBeInTheDocument()
  },
}

/**
 * Opened, which is the whole point of a fold rather than a hide: WHICH four files, on demand.
 *
 * The click lands anywhere on the line, not on the caret — the counts are what a hand goes to.
 */
export const Opened: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByText(/feedRows\.ts/)).not.toBeInTheDocument()
    await userEvent.click(canvas.getByText(/Read 3 files, searched 1 pattern/))
    await expect(canvas.getByText(/feedRows\.ts/)).toBeInTheDocument()
    await expect(canvas.getByText(/turnFeedRows/)).toBeInTheDocument()
  },
}

/** A run of one. Still the quiet row rather than a row of its own: a single read is provenance too,
 * and giving it a card would put one glance at a file at the weight of a change to it. */
export const SingleCall: Story = {
  args: {
    row: {
      kind: 'quiet',
      observed: true,
      key: 'quiet:c1',
      counts: [{ word: 'read', count: 1 }],
      calls: [reads[0] as QuietCallModel],
    },
  },
}

/** Thirty of them, which is the case the label exists for. */
export const LongRun: Story = {
  args: {
    row: {
      kind: 'quiet',
      observed: true,
      key: 'quiet:c1',
      counts: [
        { word: 'read', count: 18 },
        { word: 'searched', count: 11 },
        { word: 'fetched', count: 1 },
      ],
      calls: [...many('read', 18, 0), ...many('searched', 11, 18), ...many('fetched', 1, 29)],
    },
  },
}

/**
 * A run holding a tool Argo does not recognise. It still FOLDS — folding is the quieter reading and
 * ambiguity resolves that direction — but it drops the binoculars for a neutral mark, because
 * `other` is the parser saying it did not know the name and an unknown name is not evidence of a
 * read. `EnterWorktree` is the case that named this: it creates a worktree on disk, and it was
 * rendering under a pair of binoculars.
 *
 * The counts still spell the tools out, so nothing is hidden by the mark being quieter.
 */
export const Unrecognised: Story = {
  args: {
    row: {
      kind: 'quiet',
      observed: false,
      key: 'quiet:c9',
      counts: [
        { word: 'read', count: 1 },
        { word: 'EnterWorktree', count: 1 },
      ],
      calls: [
        reads[0] as QuietCallModel,
        {
          key: 'quiet-call:w1',
          word: 'EnterWorktree',
          target: null,
          isPath: false,
          callKind: 'other',
          status: 'completed',
          output: null,
        },
      ],
    },
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(/Read 1 file, EnterWorktree 1/),
    ).toBeInTheDocument()
  },
}
