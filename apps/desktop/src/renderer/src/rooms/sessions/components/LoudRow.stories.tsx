import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Text, WarningIcon } from '@/shared/components/ui'
import { FAILED_RING, LoudRow } from './LoudRow'

const meta = {
  title: 'Sessions/Activity/LoudRow',
  component: LoudRow,
  args: {
    mark: { Icon: WarningIcon, word: 'failed', tone: 'text-tone-red', ring: FAILED_RING },
    subject: 'bun run typecheck',
  },
  argTypes: { mark: { control: false, table: { type: { summary: 'RowMark' } } } },
  decorators: [
    (Story) => (
      <div className="w-lg bg-panel p-region">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LoudRow>

export default meta
type Story = StoryObj<typeof meta>

/** The shell: a mark, a word, the subject, and a ring for the state worth ringing. What hangs beneath
 * is the caller's — a diff, an output, or a line saying why there is neither. */
export const Ringed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('failed')).toBeInTheDocument()
    await expect(canvas.getByText('bun run typecheck')).toBeInTheDocument()
  },
}

/** No ring and NO WORD, which is the ordinary case: a surface outlined on every row has no emphasis
 * left to spend, so only a deletion and a failure get one — and a finished command needs no `RAN` in
 * front of the line it ran. The subject then starts on the axis the mark column sets. */
export const Plain: Story = {
  args: { mark: { ...meta.args.mark, word: null, tone: 'text-foreground-soft', ring: '' } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByText('failed')).not.toBeInTheDocument()
  },
}

/** A body and a trailing count — the mutation row's shape, which is what this shell exists to share
 * with the command row rather than have spelled out twice. */
export const WithBodyAndCount: Story = {
  args: {
    mark: { ...meta.args.mark, word: 'edited', tone: 'text-foreground-soft', ring: '' },
    subject: 'src/auth/rotation.ts',
    trailing: (
      <Text variant="meta" className="shrink-0 tabular-nums text-signal-ok">
        +6
      </Text>
    ),
    children: (
      <Text variant="code" className="text-foreground-faint">
        whatever the row has to show
      </Text>
    ),
  },
}

/** A subject longer than the row. It truncates rather than pushing the count off the edge: the churn
 * is the fact you scan a wall of these by, so it is the one part that never gives way. */
export const LongSubject: Story = {
  args: {
    subject: 'apps/desktop/src/renderer/src/rooms/sessions/components/interiorActivity.stories.tsx',
  },
}
