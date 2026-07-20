import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { Button } from './button'
import { GitPullRequestIcon } from './icons'
import { Text } from './Text'

const VARIANTS = ['primary', 'ghost', 'review-secondary'] as const

const meta = {
  title: 'UI/Button',
  component: Button,
  args: { children: 'Commit', onClick: fn() },
  // cva surfaces the variant union as a plain string, so the control has to be declared here.
  argTypes: {
    variant: { control: 'select', options: VARIANTS },
    disabled: { control: 'boolean' },
    asChild: { control: 'boolean' },
    children: { control: 'text' },
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

// Ghost is the default: R2 allows ONE primary on screen, so the gradient is opted into.
// The label wears the row-strong role, composed from Text's role map rather than
// re-spelled here — `asChild` rules out wrapping the children in <Text>.
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Commit' })
    await expect(button).toHaveClass('text-row-strong')
    // The motion role has to resolve to the contract's --time-fast, not to a Tailwind default.
    await expect(getComputedStyle(button).transitionDuration).toBe('0.15s')
  },
}

// Disabled is the only boolean that changes the render; the enabled side is Default. A
// disabled primary drops its gradient so a dead control never reads as the primary action.
export const Disabled: Story = { args: { variant: 'primary', disabled: true } }

// A control that leads somewhere is a link wearing the button's shape.
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

// Composed-of: Icon + label. The glyph takes its box from the control's own type role.
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

// The whole variant union in one frame, enabled over disabled — the visual-diff surface.
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-gap">
      {VARIANTS.map((variant) => (
        <div className="flex items-center gap-gap" key={variant}>
          <Text variant="meta" className="w-32 text-foreground-faint">
            {variant}
          </Text>
          <Button variant={variant}>{variant}</Button>
          <Button variant={variant} disabled>
            {variant}
          </Button>
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole('button')).toHaveLength(VARIANTS.length * 2)
  },
}
