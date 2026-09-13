import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { drawnColor } from './appearanceProbe'
import { FeedCode } from './FeedCode'
import { SAMPLE_TYPESCRIPT } from './feedSamples'

const meta: Meta<typeof FeedCode> = {
  title: 'Sessions/Feed/Code',
  component: FeedCode,
  decorators: [
    (Story) => (
      <div className="max-w-2xl p-6">
        <Story />
      </div>
    ),
  ],
  args: { source: SAMPLE_TYPESCRIPT, language: 'ts' },
}

export default meta
type Story = StoryObj<typeof FeedCode>

function highlightedCode(canvasElement: HTMLElement) {
  return canvasElement.querySelector('code[data-highlighted="true"]')
}

export const Highlighted: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('TypeScript')).toBeInTheDocument()
    await waitFor(() => expect(highlightedCode(canvasElement)).not.toBeNull())
    const keyword = canvas.getByText('type')
    const dark = drawnColor(keyword.style.getPropertyValue('--shiki-dark'))
    await expect(dark).not.toBe(drawnColor(keyword.style.getPropertyValue('--shiki-light')))
    await expect(getComputedStyle(keyword).color).toBe(dark)
  },
}

// The plain block and the highlighted one of the same source stand side by side, and the
// highlighter may only change their colour (ADR-0035 rule 2).
export const StableGeometry: Story = {
  render: (args) => (
    <div className="space-y-4">
      <FeedCode {...args} language="ts" />
      <FeedCode {...args} language="argo-plan" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(highlightedCode(canvasElement)).not.toBeNull())
    const [highlighted, plain] = [...canvasElement.querySelectorAll('pre')]
    await expect(highlighted?.getBoundingClientRect().height).toBe(
      plain?.getBoundingClientRect().height,
    )
    await expect(highlighted?.getBoundingClientRect().width).toBe(
      plain?.getBoundingClientRect().width,
    )
  },
}

export const UnknownLanguage: Story = {
  args: { source: 'step one: attach an image\nstep two: send the Turn', language: 'argo-plan' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('img', { name: 'Code file' })).toBeInTheDocument()
    await expect(canvasElement.querySelector('[data-language]')).toHaveAttribute(
      'data-language',
      'plain',
    )
    await expect(canvasElement.querySelector('code')).toHaveTextContent(
      'step one: attach an imagestep two: send the Turn',
    )
    await expect(canvasElement.querySelector('code')).toHaveAttribute('data-highlighted', 'false')
  },
}

export const CopyFromKeyboard: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.tab()
    await expect(
      within(canvasElement).getByRole('button', { name: 'Copy TypeScript code' }),
    ).toHaveFocus()
  },
}
