import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import {
  longTerminalOutput,
  terminalOutputCases,
  terminalProtocolOutput,
} from '@/mocks/sessions/terminal-output'
import { Terminal } from './terminal'

const meta = {
  title: 'Features/Sessions/Terminal',
  component: Terminal,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="w-full max-w-3xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Terminal>

export default meta
type Story = StoryObj<typeof Terminal>

export const ProtocolColors: Story = {
  args: { output: terminalProtocolOutput },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Terminal')).toBeVisible()
    await expect(canvas.getByText('red foreground')).toBeVisible()
    await expect(canvas.getByText('bright cyan foreground')).toBeVisible()
    await expect(canvas.getByText('true color')).toBeVisible()
    await expect(canvas.getByText('indexed yellow output')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Copy terminal output' })).toBeEnabled()
  },
}

export const DimAndWeight: Story = {
  args: { output: terminalOutputCases.decorations },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const text of ['bold output', 'dim output', 'last decoration wins', 'plain output']) {
      await expect(canvas.getByText(text)).toBeVisible()
    }
  },
}

async function copyOutput(canvasElement: HTMLElement, output: string) {
  const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
  const writeText = fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  })
  try {
    const canvas = within(canvasElement)
    const button = canvas.getByRole('button', { name: 'Copy terminal output' })
    button.focus()
    await expect(button).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await expect(writeText).toHaveBeenCalledWith(output)
    await expect(await canvas.findByText('Copied to clipboard')).toBeInTheDocument()
  } finally {
    if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard)
    else Reflect.deleteProperty(navigator, 'clipboard')
  }
}

export const SelectionAndCopy: Story = {
  args: { output: `${terminalOutputCases.trueColor}\nready\n` },
  play: async ({ args, canvasElement }) => {
    const code = within(canvasElement).getByRole('code')
    const selection = canvasElement.ownerDocument.getSelection()
    if (selection === null) throw new Error('Terminal output needs a document selection.')
    try {
      selection.selectAllChildren(code)
      await expect(selection.toString()).toBe('true color\nready')
      await copyOutput(canvasElement, args.output)
    } finally {
      selection.removeAllRanges()
    }
  },
}

export const LongOutput: Story = {
  args: { output: longTerminalOutput },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const output = canvas.getByRole('region', { name: 'Terminal output' })
    output.focus()
    await expect(output).toHaveFocus()
    await userEvent.keyboard('{End}')
    await expect(canvas.getByRole('code')).toHaveTextContent('Build step 1:')
    const last = canvas.getByText(/Build complete/)
    last.scrollIntoView({ block: 'nearest' })
    await expect(last).toBeVisible()
    await copyOutput(canvasElement, args.output)
  },
}
