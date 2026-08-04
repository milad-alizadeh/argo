import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  BinocularsIcon,
  FileMinusIcon,
  type IconAtom,
  TerminalWindowIcon,
  Text,
  WarningIcon,
} from '@/shared/components/ui'
import { RowGlyph } from './RowGlyph'

const meta = {
  title: 'Sessions/Activity/RowGlyph',
  component: RowGlyph,
  args: { Icon: BinocularsIcon, tone: 'text-foreground-faint' },
  argTypes: { Icon: { control: false, table: { type: { summary: 'IconAtom' } } } },
  decorators: [
    (Story) => (
      <div className="w-lg bg-panel p-region">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RowGlyph>

export default meta
type Story = StoryObj<typeof meta>

/** One glyph in the column. Alone it is nearly nothing to look at, which is the point: the atom's
 * whole job is that the row beside it starts on the same axis as every other row's. */
export const Mark: Story = {}

// The four the feed actually uses, so the cell is judged against glyphs of different widths — which
// is the one thing a column measured from its contents gets wrong.
const FEED_GLYPHS: readonly [IconAtom, string, string][] = [
  [BinocularsIcon, 'text-foreground-faint', 'read 3 · searched 1'],
  [FileMinusIcon, 'text-signal-bad', 'DELETED src/auth/legacy.ts'],
  [TerminalWindowIcon, 'text-foreground-soft', 'RAN bun run test'],
  [WarningIcon, 'text-tone-red', 'FAILED bun run typecheck'],
]

/** The gallery: every glyph the feed hangs here, each with the text it marks. Read down the left edge
 * — one column — and down the second, where every line starts on one axis. */
export const InTheColumn: Story = {
  render: () => (
    <div className="flex flex-col gap-tight">
      {FEED_GLYPHS.map(([Icon, tone, label]) => (
        <div key={label} className="flex items-baseline gap-snug">
          <RowGlyph Icon={Icon} tone={tone} />
          <Text variant="code" className="text-foreground-soft">
            {label}
          </Text>
        </div>
      ))}
    </div>
  ),
}
