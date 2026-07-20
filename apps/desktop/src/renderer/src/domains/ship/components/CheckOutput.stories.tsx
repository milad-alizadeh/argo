import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { CheckOutput, LOCAL_CHECKS } from './CheckOutput'

const meta = {
  title: 'Ship/CheckOutput',
  component: CheckOutput,
  argTypes: {
    check: { control: 'select', options: LOCAL_CHECKS },
    command: { control: 'text' },
    output: { control: 'text' },
  },
} satisfies Meta<typeof CheckOutput>

export default meta
type Story = StoryObj<typeof meta>

/** A passing local run — Argo's own captured output for this tree, sha-keyed via the
 * Commits node drawer (R11), distinct from `PrChecksList`'s remote-origin runs. */
export const Default: Story = {
  args: {
    check: 'tests',
    command: 'bun run test',
    output: '✓ 42 passed\n  ribbonNodeState.test.ts (4)\n  useDisclosure.test.ts (4)',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Tests')).toBeInTheDocument()
    await expect(canvas.getByText('Argo · this tree')).toBeInTheDocument()
    await expect(canvas.getByText('bun run test')).toBeInTheDocument()
  },
}

/** Every local check this card can name. */
export const EveryCheck: Story = {
  args: { ...Default.args },
  render: () => (
    <div className="flex flex-col gap-gap">
      {LOCAL_CHECKS.map((check) => (
        <CheckOutput key={check} check={check} command="bun run lint" output="clean" />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const label of ['Lint', 'Typecheck', 'Tests']) {
      await expect(canvas.getByText(label)).toBeInTheDocument()
    }
  },
}

/** The feed renders as text, preserving the tool's own line breaks — never markup. */
export const MultilineFeed: Story = {
  args: {
    check: 'lint',
    command: 'bun run format-and-lint',
    output: 'apps/desktop/src/App.tsx\n  12:3  error  unused import\n\n1 problem (1 error)',
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/1 problem/)).toBeInTheDocument()
  },
}
