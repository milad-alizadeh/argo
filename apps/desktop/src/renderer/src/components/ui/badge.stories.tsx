import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Badge } from './badge'
import { CheckIcon, CircleIcon, CircleNotchIcon } from './icons'
import { Text } from './Text'

const VARIANTS = [
  'neutral',
  'warn',
  'primary',
  'verdict-block',
  'verdict-changes',
  'verdict-approve',
] as const

const SHAPES = ['default', 'pill'] as const

const meta = {
  title: 'Cockpit/Badge',
  component: Badge,
  args: { children: 'worktree' },
  // cva surfaces the variant union as a plain string, so the control is declared here.
  argTypes: {
    variant: { control: 'select', options: VARIANTS },
    shape: { control: 'select', options: SHAPES },
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

// Every tone in both shapes — the visual-diff surface for the whole variant map. A caption
// names the token a tone spends, never what a caller reads into it.
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-gap">
      {VARIANTS.map((variant) => (
        <div className="flex items-center gap-gap" key={variant}>
          <Text variant="meta" className="w-36 text-foreground-faint">
            {variant}
          </Text>
          {SHAPES.map((shape) => (
            <Badge key={shape} variant={variant} shape={shape}>
              {shape}
            </Badge>
          ))}
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByText('pill')).toHaveLength(VARIANTS.length)
  },
}

// Composed-of: Icon + label. The badge sizes the glyph off its own tag role, so a pill with
// a leading glyph — the shape a review finding reports its state in — needs no component of
// its own.
export const WithIcon: Story = {
  render: () => (
    <div className="flex items-center gap-region">
      <Badge shape="pill" variant="verdict-block">
        <CircleIcon aria-hidden />
        open
      </Badge>
      <Badge shape="pill" variant="verdict-changes">
        <CircleNotchIcon aria-hidden />
        addressing
      </Badge>
      <Badge shape="pill" variant="verdict-approve">
        <CheckIcon aria-hidden />
        fixed
      </Badge>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const chip = within(canvasElement).getByText('addressing')
    // The word is authored in sentence case; the tag role is what uppercases it, so the
    // accessible text stays what the caller wrote.
    await expect(getComputedStyle(chip).textTransform).toBe('uppercase')
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
