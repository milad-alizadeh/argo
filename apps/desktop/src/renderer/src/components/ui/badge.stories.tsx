import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Badge } from './badge'
import { Text } from './Text'

const VARIANTS = ['neutral', 'warn', 'primary'] as const

const meta = {
  title: 'Cockpit/Badge',
  component: Badge,
  args: { children: 'worktree' },
  // cva surfaces the variant union as a plain string, so the control is declared here.
  argTypes: {
    variant: { control: 'select', options: VARIANTS },
    children: { control: 'text' },
  },
} satisfies Meta<typeof Badge>

export default meta
type Story = StoryObj<typeof meta>

// The label is authored lower-case and the `tag` role uppercases it, so the accessible
// text stays what the caller wrote.
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('worktree')).toHaveClass('text-tag')
  },
}

// The three badge treatments side by side, each under the copy it actually carries.
export const AllVariants: Story = {
  render: () => (
    <div className="flex items-center gap-gap">
      <Badge variant="neutral">main tree</Badge>
      <Badge variant="warn">uncommitted</Badge>
      <Badge variant="primary">declared</Badge>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('declared')).toBeInTheDocument()
  },
}

// `asChild` is the kit's escape hatch: the badge's styling merges onto the caller's own
// element, which is why the label cannot be wrapped in a <Text> inside the component.
export const AsChild: Story = {
  args: { asChild: true },
  render: (args) => (
    <Badge {...args}>
      <Text as="div" variant="tag">
        adopted worktree
      </Text>
    </Badge>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('adopted worktree').tagName).toBe('DIV')
  },
}
