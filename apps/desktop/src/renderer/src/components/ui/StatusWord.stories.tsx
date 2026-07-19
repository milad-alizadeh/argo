import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { StatusWord } from './StatusWord'

const meta = {
  title: 'Cockpit/StatusWord',
  component: StatusWord,
} satisfies Meta<typeof StatusWord>

export default meta
type Story = StoryObj<typeof meta>

const expectWord =
  (word: string): Story['play'] =>
  async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(word)).toBeInTheDocument()
  }

export const Running: Story = {
  args: { word: 'Running', tone: 'run' },
  play: expectWord('Running'),
}
export const NeedsInput: Story = {
  args: { word: 'Needs input', tone: 'amber' },
  play: expectWord('Needs input'),
}
export const Done: Story = { args: { word: 'Done', tone: 'mist' }, play: expectWord('Done') }
export const Queued: Story = { args: { word: 'Queued', tone: 'gray' }, play: expectWord('Queued') }
export const Failed: Story = { args: { word: 'Failed', tone: 'red' }, play: expectWord('Failed') }
export const Orphaned: Story = {
  args: { word: 'Orphaned', tone: 'stale' },
  play: expectWord('Orphaned'),
}
export const Landed: Story = {
  args: { word: 'Landed', tone: 'landed' },
  play: expectWord('Landed'),
}

// Ribbon-derived words are longer than the lifecycle vocabulary and must not wrap.
export const LongWord: Story = {
  args: { word: 'Auto-merge armed', tone: 'landed' },
  play: expectWord('Auto-merge armed'),
}

export const EmptyWord: Story = {
  args: { word: '', tone: 'mist' },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('span')?.textContent).toBe('')
  },
}
