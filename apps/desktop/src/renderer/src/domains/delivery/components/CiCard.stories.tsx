import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Text } from '@/shared/components/ui'
import { CiCard } from './CiCard'

const meta = {
  title: 'Delivery/CiCard',
  component: CiCard,
  argTypes: {
    heading: { control: false },
    trailing: { control: false },
    children: { control: false },
  },
} satisfies Meta<typeof CiCard>

export default meta
type Story = StoryObj<typeof meta>

/** The shape PrChecksList composes it in: a keyed-to heading plus a right-aligned
 * aggregate rollup. */
export const Default: Story = {
  args: {
    heading: (
      <Text variant="tag" className="text-muted-foreground">
        CI · GitHub Actions · a1b2c3d
      </Text>
    ),
    trailing: (
      <Text variant="meta" className="tabular-nums text-foreground-faint">
        1 running · 2 passed
      </Text>
    ),
    children: (
      <div className="px-inset py-snug">
        <Text variant="row">run rows land here</Text>
      </div>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/CI · GitHub Actions/)).toBeInTheDocument()
    await expect(canvas.getByText('1 running · 2 passed')).toBeInTheDocument()
  },
}

/** The shape CheckOutput composes it in: no aggregate, just a heading over the feed. */
export const WithoutTrailing: Story = {
  args: {
    heading: (
      <Text variant="tag" className="text-muted-foreground">
        Lint · Argo · this tree
      </Text>
    ),
    children: (
      <div className="px-inset py-snug">
        <Text variant="code">$ eslint .</Text>
      </div>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/Lint · Argo/)).toBeInTheDocument()
    await expect(canvas.queryByText(/passed/)).not.toBeInTheDocument()
  },
}
