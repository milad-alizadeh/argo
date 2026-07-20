import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { RAIL_ICONS, RAIL_TONES } from '@/shared/ship'
import { Text } from '../Text'
import { StatusIcon } from './StatusIcon'

const meta = {
  title: 'Shared/StatusIcon',
  component: StatusIcon,
  argTypes: {
    icon: { control: 'select', options: RAIL_ICONS },
    tone: { control: 'select', options: RAIL_TONES },
  },
} satisfies Meta<typeof StatusIcon>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The glyph is decorative (aria-hidden), so the only thing to assert is that a name resolves
 * to a drawn svg — the row's word carries the accessible meaning.
 */
export const Default: Story = {
  args: { icon: 'circle-notch', tone: 'run' },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('svg')).toBeInTheDocument()
  },
}

/**
 * Every icon name in one frame — the visual-diff surface for the ship's glyph set. One tone
 * throughout: the tone↔colour pairing is StatusDot's gallery, not this one.
 */
export const AllIcons: Story = {
  args: { icon: 'circle-notch', tone: 'run' },
  render: () => (
    <div className="flex flex-wrap items-start gap-region">
      {RAIL_ICONS.map((icon) => (
        <span className="flex w-20 flex-col items-center gap-gap" key={icon}>
          <StatusIcon icon={icon} tone="run" />
          <Text variant="meta" className="text-foreground-faint">
            {icon}
          </Text>
        </span>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('git-merge')).toBeInTheDocument()
  },
}
