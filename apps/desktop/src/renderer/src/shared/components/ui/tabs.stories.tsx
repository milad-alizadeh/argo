import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs'

const TONES = ['neutral', 'changes'] as const

const meta = {
  title: 'Shared/Tabs',
  component: Tabs,
  argTypes: {
    defaultValue: { control: false },
  },
} satisfies Meta<typeof Tabs>

export default meta
type Story = StoryObj<typeof meta>

/** The `neutral` tone — the strip DeliveryTabs builds its Changes/Artifacts triggers from. */
export const Default: Story = {
  render: () => (
    <Tabs defaultValue="changes">
      <TabsList aria-label="Work">
        <TabsTrigger value="changes">Changes · 12</TabsTrigger>
        <TabsTrigger value="artifacts">Artifacts · 4</TabsTrigger>
      </TabsList>
      <TabsContent value="changes">Changes content</TabsContent>
      <TabsContent value="artifacts">Artifacts content</TabsContent>
    </Tabs>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const changes = canvas.getByRole('tab', { name: 'Changes · 12' })
    const artifacts = canvas.getByRole('tab', { name: 'Artifacts · 4' })
    await expect(changes).toHaveAttribute('aria-selected', 'true')
    await userEvent.click(artifacts)
    await expect(artifacts).toHaveAttribute('aria-selected', 'true')
    await expect(canvas.getByText('Artifacts content')).toBeVisible()
  },
}

/** `changes` tints the trigger amber — the Review tab's outstanding-findings state. */
export const ChangesTone: Story = {
  render: () => (
    <Tabs defaultValue="review">
      <TabsList aria-label="Work">
        <TabsTrigger value="changes">Changes · 12</TabsTrigger>
        <TabsTrigger value="review" tone="changes">
          Review · 2
        </TabsTrigger>
      </TabsList>
      <TabsContent value="changes">Changes content</TabsContent>
      <TabsContent value="review">Review content</TabsContent>
    </Tabs>
  ),
  play: async ({ canvasElement }) => {
    const tab = within(canvasElement).getByRole('tab', { name: 'Review · 2' })
    await expect(tab).toHaveClass('text-verdict-changes')
  },
}

/** Both tones, active state highlighted — the visual-diff surface for the trigger's cva map. */
export const AllTones: Story = {
  render: () => (
    <div className="flex gap-region">
      {TONES.map((tone) => (
        <Tabs defaultValue="on" key={tone}>
          <TabsList aria-label={tone}>
            <TabsTrigger value="on" tone={tone}>
              {tone} · on
            </TabsTrigger>
            <TabsTrigger value="off" tone={tone}>
              {tone} · off
            </TabsTrigger>
          </TabsList>
        </Tabs>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole('tab')).toHaveLength(TONES.length * 2)
  },
}
