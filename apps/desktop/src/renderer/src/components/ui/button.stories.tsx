import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { Button } from './button'

const VARIANTS = ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] as const
const SIZES = ['default', 'xs', 'sm', 'lg'] as const

const meta = {
  title: 'UI/Button',
  component: Button,
  args: { children: 'Button', onClick: fn() },
  // cva surfaces both unions as plain strings, so the controls have to be declared here.
  argTypes: {
    variant: { control: 'select', options: VARIANTS },
    size: {
      control: 'select',
      options: [...SIZES, 'icon', 'icon-xs', 'icon-sm', 'icon-lg'],
    },
    disabled: { control: 'boolean' },
    children: { control: 'text' },
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

// The label wears the row-strong role, composed from Text's role map rather than
// re-spelled here — `asChild` rules out wrapping the children in <Text>.
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Button' })
    await expect(button).toHaveClass('text-row-strong')
  },
}

// Disabled is the only boolean that changes the render; the enabled side is Default.
export const Disabled: Story = { args: { disabled: true } }

// Every variant across every text size — one frame covering both unions at once.
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-gap">
      {VARIANTS.map((variant) => (
        <div className="flex items-center gap-gap" key={variant}>
          {SIZES.map((size) => (
            <Button key={size} variant={variant} size={size}>
              {variant}
            </Button>
          ))}
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole('button')).toHaveLength(
      VARIANTS.length * SIZES.length,
    )
  },
}
