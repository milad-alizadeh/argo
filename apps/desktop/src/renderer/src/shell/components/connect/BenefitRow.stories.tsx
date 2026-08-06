import type { Meta, StoryObj } from '@storybook/react-vite'
import { BinocularsIcon } from '@/shared/components/ui'
import { BenefitRow } from './BenefitRow'

const meta = {
  title: 'Shell/ConnectPanel/WelcomeScreen/BenefitRow',
  component: BenefitRow,
  args: {
    icon: BinocularsIcon,
    title: 'See every agent at once',
    detail:
      'Each coding session you have running, what it is doing right now, and which one is waiting on you.',
  },
  argTypes: {
    title: { control: 'text' },
    detail: { control: 'text' },
    icon: { control: false, table: { type: { summary: 'IconAtom' } } },
  },
} satisfies Meta<typeof BenefitRow>

export default meta
type Story = StoryObj<typeof meta>

/**
 * One line about what Argo does.
 *
 * The glyph is decorative and the title carries the claim, so the row still reads with the
 * icon column ignored entirely.
 */
export const Default: Story = {}
