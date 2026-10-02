import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './accordion'

const meta = { title: 'Design System/Primitives/Accordion', component: Accordion } satisfies Meta<typeof Accordion>
export default meta
type Story = StoryObj<typeof meta>

export const Disclosure: Story = {
  render: () => <Accordion className="w-96"><AccordionItem value="details"><AccordionTrigger>Project details</AccordionTrigger><AccordionContent>Workspace configuration and access.</AccordionContent></AccordionItem></Accordion>,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: 'Project details' })
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(trigger)
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await expect(canvas.getByText('Workspace configuration and access.')).toBeVisible()
  },
}
