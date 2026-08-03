import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { Text } from './Text'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip'

const meta = {
  title: 'Shared/Tooltip',
  component: TooltipContent,
} satisfies Meta<typeof TooltipContent>

export default meta
type Story = StoryObj<typeof meta>

/** The shell's one mandated tooltip: the active project tab reveals its name and when the
 * project last synced, which appear nowhere else in the chrome. */
export const Default: Story = {
  render: () => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Text variant="row">A</Text>
        </TooltipTrigger>
        <TooltipContent>
          <Text variant="row" as="div">
            argo
          </Text>
          <Text variant="meta" as="div" className="text-foreground-faint">
            last synced 4m ago
          </Text>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.hover(within(canvasElement).getByText('A'))
    const tooltip = await within(document.body).findByRole('tooltip')
    await expect(tooltip).toHaveTextContent('argo')
    await expect(tooltip).toHaveTextContent('last synced 4m ago')
  },
}
