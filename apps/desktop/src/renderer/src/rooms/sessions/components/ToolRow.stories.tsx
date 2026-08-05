import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Text, WarningIcon } from '@/shared/components/ui'
import { inkFor } from './minimapMatrix'
import { PathSubject } from './PathSubject'
import { ToolRow } from './ToolRow'

const meta = {
  title: 'Sessions/Activity/ToolRow',
  component: ToolRow,
  args: {
    mark: { Icon: WarningIcon, word: 'failed', tone: inkFor('call', true) },
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
} satisfies Meta<typeof ToolRow>

export default meta
type Story = StoryObj<typeof meta>

/** THE row — every tool call on the surface is this one component, and a failure is not an exception
 * to it. What a row IS travels in the COLOUR of its glyph and verb and nowhere else: no box, no
 * ring, no margin stub. The ink comes from the same table the minimap paints from, so the strip on
 * the feed's right edge is read against this column rather than against a legend nobody wrote. */
export const Failed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('failed')).toBeInTheDocument()
    await expect(canvas.getByText('bun run typecheck')).toBeInTheDocument()
  },
}

/** The same row, one hue over. This is the WHOLE of the variation between a command, a failure, a
 * change and a folded read — which is why they are one component and not four. */
export const Plain: Story = {
  args: { mark: { ...meta.args.mark, word: 'ran', tone: inkFor('call') } },
}

/** A body and a trailing count — the mutation row's shape. The body is CLOSED: a caret leads the
 * line, and nothing opens until it is asked to. */
export const WithBodyAndCount: Story = {
  args: {
    mark: { ...meta.args.mark, word: 'edited', tone: inkFor('mutation') },
    subject: <PathSubject path="src/auth/rotation.ts" absent="nothing the record named" />,
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

/** A PATH longer than the row, cut where a path has to be cut: from the HEAD, so the ellipsis leads
 * and the filename survives. Every path on this surface goes through `PathSubject` for exactly this
 * — a column of edits under one worktree shares fifty characters of prefix, and end-truncation
 * renders them as the same string with the one differing word dropped. */
export const LongPath: Story = {
  args: {
    subject: (
      <PathSubject
        path="apps/desktop/src/renderer/src/rooms/sessions/components/interiorActivity.stories.tsx"
        absent="nothing the record named"
      />
    ),
  },
  play: async ({ canvasElement }) => {
    const path = within(canvasElement).getByText(/interiorActivity\.stories\.tsx$/)
    await expect(path).toHaveAttribute('dir', 'rtl')
  },
}

/** A subject that is NOT a path — a command line has slashes but no filename to lead with, so it
 * reads whole and truncates at the end like ordinary text. */
export const LongCommand: Story = {
  args: { subject: 'bun run test --filter @argo/desktop --reporter verbose --coverage' },
}

/** The one row that starts OPEN: a picture. Everything else opens onto evidence for what the line
 * already said and waits to be asked; an image is the fact itself. A starting position, not a second
 * mechanism — the same caret closes it again. */
export const OpenByDefault: Story = {
  args: {
    mark: { ...meta.args.mark, word: 'saw', tone: inkFor('media') },
    subject: <PathSubject path="/tmp/argo-shots/cockpit.png" absent="nothing the record named" />,
    defaultOpen: true,
    children: (
      <Text variant="code" className="text-foreground-faint">
        whatever the row has to show
      </Text>
    ),
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(/whatever the row has to show/),
    ).toBeInTheDocument()
  },
}

/** Nothing to open. The caret's cell is still spent so the marks beside it stay in a column, but no
 * caret is drawn on a row that would do nothing if you hit it, and the line is not a button. */
export const NothingToOpen: Story = {
  args: { children: undefined },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button')).not.toBeInTheDocument()
  },
}
