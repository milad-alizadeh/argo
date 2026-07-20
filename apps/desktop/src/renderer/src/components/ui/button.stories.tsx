import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { Button } from './button'
import { ArrowBendDownRightIcon, GitPullRequestIcon } from './icons'
import { Text } from './Text'

const VARIANTS = [
  'primary',
  'ghost',
  'review-secondary',
  'verdict-changes',
  'verdict-approve',
] as const

const SIZES = ['default', 'sm'] as const

const meta = {
  title: 'UI/Button',
  component: Button,
  args: { children: 'Commit', onClick: fn() },
  // cva surfaces the variant union as a plain string, so the control has to be declared here.
  argTypes: {
    variant: {
      control: 'select',
      options: VARIANTS,
      description:
        'The token the control spends, never the state a caller is in. `ghost` is the default because R2 allows ONE `primary` gradient per screen; `review-secondary` is what every Review-tab control wears, and the `verdict-*` tints carry their weight without spending that one primary.',
      table: {
        type: { summary: VARIANTS.join(' | ') },
        defaultValue: { summary: 'ghost' },
      },
    },
    size: {
      control: 'select',
      options: SIZES,
      description:
        'The whole padding box, stated per size rather than merged. `sm` is the tighter box for a control wedged into a dense row — under a diff hunk it has to give the code back its room.',
      table: {
        type: { summary: SIZES.join(' | ') },
        defaultValue: { summary: 'default' },
      },
    },
    disabled: { control: 'boolean' },
    asChild: { control: 'boolean' },
    children: { control: 'text' },
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Ghost is the default: R2 allows ONE primary on screen, so the gradient is opted into. The
 * label wears the row-strong role, composed from Text's role map rather than re-spelled
 * here — `asChild` rules out wrapping the children in `<Text>`.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Commit' })
    await expect(button).toHaveClass('text-row-strong')
    // The motion role has to resolve to the contract's --time-fast, not to a Tailwind default.
    await expect(getComputedStyle(button).transitionDuration).toBe('0.15s')
  },
}

/**
 * Disabled is the only boolean that changes the render; the enabled side is Default. A
 * disabled primary drops its gradient so a dead control never reads as the primary action.
 */
export const Disabled: Story = { args: { variant: 'primary', disabled: true } }

/** A control that leads somewhere is a link wearing the button's shape. */
export const AsChild: Story = {
  args: {
    asChild: true,
    variant: 'review-secondary',
    children: <a href="#pr">Open PR</a>,
  },
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole('link', { name: 'Open PR' })
    await expect(link).toHaveClass('text-row-strong')
  },
}

/** Composed-of: Icon + label. The glyph takes its box from the control's own type role. */
export const WithIcon: Story = {
  args: {
    variant: 'primary',
    children: (
      <>
        <GitPullRequestIcon aria-hidden />
        Create PR
      </>
    ),
  },
}

/**
 * The whole variant union across both sizes, enabled over disabled — the visual-diff surface.
 * Verdict tones carry their weight in the tint, so they take a glyph the way the controls
 * that wedge into a review row do.
 */
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-gap">
      {VARIANTS.map((variant) => (
        <div className="flex items-center gap-gap" key={variant}>
          <Text variant="meta" className="w-36 text-foreground-faint">
            {variant}
          </Text>
          {SIZES.map((size) => (
            <Button key={size} variant={variant} size={size}>
              <ArrowBendDownRightIcon aria-hidden />
              {variant}
            </Button>
          ))}
          <Button variant={variant} disabled>
            {variant}
          </Button>
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('button')).toHaveLength(VARIANTS.length * (SIZES.length + 1))
  },
}
