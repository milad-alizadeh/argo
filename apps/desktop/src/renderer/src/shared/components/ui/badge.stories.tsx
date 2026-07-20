import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Badge } from './badge'
import { CircleIcon } from './icons'
import { Text } from './Text'

const VERDICT_VARIANTS = ['verdict-block', 'verdict-changes', 'verdict-approve'] as const

const VARIANTS = ['neutral', 'warn', 'primary', ...VERDICT_VARIANTS] as const

const SHAPES = ['default', 'pill'] as const

const meta = {
  title: 'Shared/Badge',
  component: Badge,
  args: { children: 'worktree' },
  // cva surfaces the variant union as a plain string, so the control is declared here.
  argTypes: {
    variant: {
      control: 'select',
      options: VARIANTS,
      description:
        "The token the label spends, never what a caller reads into it — `neutral` for a plain marker, `warn` and the three `verdict-*` tints for a chip reporting where something stands. Which state wears which tone is the caller's binding (findingState.ts).",
      table: {
        type: { summary: VARIANTS.join(' | ') },
        defaultValue: { summary: 'neutral' },
      },
    },
    shape: {
      control: 'select',
      options: SHAPES,
      description:
        'The box: `default` is the bordered mini label, `pill` sits outside the 4/6/8/12 radius family so a chip never reads as the label it travels beside.',
      table: {
        type: { summary: SHAPES.join(' | ') },
        defaultValue: { summary: 'default' },
      },
    },
    children: { control: 'text' },
  },
} satisfies Meta<typeof Badge>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The label is authored lower-case and the `tag` role uppercases it, so the accessible text
 * stays what the caller wrote.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('worktree')).toHaveClass('text-tag')
  },
}

/**
 * Every tone in both shapes — the visual-diff surface for the whole variant map. A caption
 * names the token a tone spends, never what a caller reads into it.
 */
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

/**
 * Composed-of: Icon + label. The badge sizes the glyph off its own tag role, so the pill a
 * state is reported in needs no component of its own — which state wears which tone is the
 * caller's binding (findingState.ts), never something spelled here.
 */
export const WithIcon: Story = {
  render: () => (
    <div className="flex items-center gap-region">
      {VERDICT_VARIANTS.map((variant) => (
        <Badge key={variant} shape="pill" variant={variant}>
          <CircleIcon aria-hidden />
          {variant}
        </Badge>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const chip = within(canvasElement).getByText('verdict-changes')
    // The word is authored in sentence case; the tag role is what uppercases it, so the
    // accessible text stays what the caller wrote.
    await expect(getComputedStyle(chip).textTransform).toBe('uppercase')
    await expect(chip.querySelector('svg')).toBeInTheDocument()
  },
}

/**
 * `asChild` is the kit's escape hatch: the badge's styling merges onto the caller's own
 * element, which is why the label cannot be wrapped in a `<Text>` inside the component.
 */
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
