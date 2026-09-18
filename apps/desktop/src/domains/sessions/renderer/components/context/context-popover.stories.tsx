import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fireEvent, userEvent, waitFor, within } from 'storybook/test'

import { DEFAULT_AUTO_COMPACT_LIMIT } from '../../../../../agents/codex/compaction/compaction'
import { ContextPopover } from './context-popover'

// A mock `~/.codex/config.toml`: `set` mutates it, so a later `get` (a remount, a second control)
// reads back whatever the popover last wrote, the way the real file would.
function mockCodexCompaction(startingLimit: number) {
  let limit = startingLimit
  const written: number[] = []
  return {
    written,
    beforeEach: () => {
      written.length = 0
      limit = startingLimit
      const previous = window.argo
      window.argo = {
        ...previous,
        getCodexAutoCompactLimit: () => Promise.resolve(limit),
        setCodexAutoCompactLimit: (next: number) => {
          limit = next
          written.push(next)
          return Promise.resolve(limit)
        },
      }
      return () => {
        window.argo = previous
      }
    },
  }
}

const meta: Meta<typeof ContextPopover> = {
  title: 'Sessions/Composer/Context Popover',
  component: ContextPopover,
  args: { capacityTokens: 200_000, harness: 'codex', percentage: 74, usedTokens: 148_000 },
  decorators: [(Story) => <div className="p-16">{Story()}</div>],
}

export default meta
type Story = StoryObj<typeof ContextPopover>

const mock = mockCodexCompaction(DEFAULT_AUTO_COMPACT_LIMIT)

export const StorybookHostSupportsAutoCompact: Story = {
  play: async () => {
    await expect(window.argo.getCodexAutoCompactLimit()).resolves.toBe(DEFAULT_AUTO_COMPACT_LIMIT)
  },
}

export const AutoCompactWritesToCodexConfig: Story = {
  beforeEach: mock.beforeEach,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Context details' }))

    const body = within(document.body)
    const slider = await body.findByRole('slider', { name: 'Auto-compact threshold' })
    await waitFor(() => expect(slider).toHaveValue('90'))

    fireEvent.change(slider, { target: { value: '70' } })
    await waitFor(() => expect(mock.written.at(-1)).toBe(140_000))
    const tokens = body.getByRole('spinbutton', { name: 'Auto-compact threshold tokens' })
    await waitFor(() => expect(tokens).toHaveValue(140_000))

    await userEvent.clear(tokens)
    await userEvent.type(tokens, '155000')
    await userEvent.tab()
    await waitFor(() => expect(mock.written.at(-1)).toBe(155_000))
    // 78% is the true value; the range input's own step sanitization snaps its displayed
    // position to the nearest multiple of 5, same as a person dragging it would see.
    await expect(slider).toHaveValue('80')
  },
}
