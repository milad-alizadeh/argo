import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Tabs } from '@/shared/components/ui'
import { SessionTabs } from './SessionTabs'

const meta = {
  title: 'Sessions/SessionPlane/SessionHeader/SessionTabs',
  component: SessionTabs,
  // The tablist needs its Radix root to own selection; the plane supplies it in the app.
  decorators: [
    (Story) => (
      <Tabs defaultValue="activity">
        <Story />
      </Tabs>
    ),
  ],
} satisfies Meta<typeof SessionTabs>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Two tabs, and exactly two: Outcomes was cut and Preview was never one, so the set is a constant
 * rather than a prop and there is no third state to story. Activity leads because the live world is
 * what you open a session to see.
 */
export const TwoTabs: Story = {
  play: async ({ canvasElement }) => {
    const tabs = within(canvasElement).getAllByRole('tab')
    await expect(tabs.map((tab) => tab.textContent)).toEqual(['Activity', 'Delivery'])
    await expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
  },
}
