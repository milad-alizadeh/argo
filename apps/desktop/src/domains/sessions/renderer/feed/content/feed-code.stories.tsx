import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { preloadForStories } from '@/mocks/platform/story-preload'
import { loadCodeLanguage } from '../../ai-elements'
import { FeedCode } from './feed-code'
import { SAMPLE_TYPESCRIPT } from './feed-samples'

const loadTypeScript = preloadForStories(() => loadCodeLanguage('ts'))

const meta = {
  title: 'Features/Sessions/Feed/Code',
  component: FeedCode,
  decorators: [
    (Story) => (
      <div className="max-w-2xl p-6">
        <Story />
      </div>
    ),
  ],
  args: { source: SAMPLE_TYPESCRIPT, language: 'ts' },
  loaders: [loadTypeScript],
} satisfies Meta<typeof FeedCode>

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
  },
}

export const ContentParity: Story = {
  render: (args) => (
    <div className="space-y-4">
      <FeedCode {...args} language="ts" />
      <FeedCode {...args} language="argo-plan" />
    </div>
  ),
  play: async ({ args, canvasElement }) => {
    await waitFor(() => expect(highlightedCode(canvasElement)).not.toBeNull())
    const [highlighted, plain] = [...canvasElement.querySelectorAll('code')]
    const expected = args.source.replace(/\n$/, '').split('\n').join('')
    await expect(highlighted?.textContent).toBe(expected)
    await expect(plain?.textContent).toBe(expected)
    await expect(plain).toHaveAttribute('data-highlighted', 'false')
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

export const GuessedLanguage: Story = {
  args: { source: SAMPLE_TYPESCRIPT, language: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('TypeScript')).toBeInTheDocument()
    await waitFor(() => expect(highlightedCode(canvasElement)).not.toBeNull())
  },
}

export const CopyFromKeyboard: Story = {
  play: async ({ args, canvasElement }) => {
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    const writeText = fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    try {
      const canvas = within(canvasElement)
      await userEvent.tab()
      await expect(canvas.getByRole('button', { name: 'Copy TypeScript code' })).toHaveFocus()
      await userEvent.keyboard('{Enter}')
      await expect(writeText).toHaveBeenCalledWith(args.source)
      await expect(await canvas.findByText('Copied to clipboard')).toBeInTheDocument()
    } finally {
      if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard)
      else Reflect.deleteProperty(navigator, 'clipboard')
    }
  },
}

export const LongLines: Story = {
  args: {
    source: `export const longMessage = ${JSON.stringify('Code remains selectable. '.repeat(48))}`,
  },
  play: async ({ args, canvasElement }) => {
    await waitFor(() => expect(highlightedCode(canvasElement)).not.toBeNull())
    await expect(highlightedCode(canvasElement)?.textContent).toBe(args.source)
  },
}
