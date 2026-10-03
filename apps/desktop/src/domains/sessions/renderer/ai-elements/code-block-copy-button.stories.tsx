import type { Meta } from '@storybook/react-vite'
import { createRef } from 'react'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { CodeBlock } from './code-block'
import { CodeBlockCopyButton } from './code-block-copy-button'

const SOURCE = 'export const answer = 42\n'
const buttonReference = createRef<HTMLButtonElement>()
const onButtonClick = fn()

const meta = {
  title: 'Features/Sessions/Code Copy Button',
  parameters: { layout: 'centered' },
  render: () => (
    <div className="flex w-[320px] flex-col gap-4">
      <CodeBlock code={SOURCE} language={null}>
        <div className="flex justify-end p-1">
          <CodeBlockCopyButton
            aria-label="Copy code"
            onClick={onButtonClick}
            ref={buttonReference}
            timeout={100}
          />
        </div>
      </CodeBlock>
      <CodeBlock code="disabled" language={null}>
        <div className="flex justify-end p-1">
          <CodeBlockCopyButton aria-label="Copy disabled code" disabled />
        </div>
      </CodeBlock>
    </div>
  ),
} satisfies Meta

export default meta

export const ClipboardBehavior = {
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    const writeText = fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    try {
      const canvas = within(canvasElement)
      const button = canvas.getByRole('button', { name: 'Copy code' })
      const disabledButton = canvas.getByRole('button', { name: 'Copy disabled code' })
      await expect(disabledButton).toBeDisabled()
      await expect(buttonReference.current).toBe(button)
      await userEvent.tab()
      await expect(button).toHaveFocus()
      await userEvent.keyboard('{Enter}')
      await expect(writeText).toHaveBeenCalledWith(SOURCE)
      await expect(onButtonClick).toHaveBeenCalledTimes(1)
      await expect(await canvas.findByText('Copied to clipboard')).toBeInTheDocument()

      await userEvent.click(button)
      await expect(writeText).toHaveBeenCalledTimes(2)
      await expect(onButtonClick).toHaveBeenCalledTimes(2)
      writeText.mockRejectedValueOnce(new Error('Clipboard unavailable'))
      await userEvent.click(button)
      await expect(onButtonClick).toHaveBeenCalledTimes(3)
      await expect(await canvas.findByText('Could not copy to clipboard')).toBeInTheDocument()
      await waitFor(() => expect(canvas.queryByText('Copied to clipboard')).toBeNull())
      await waitFor(() => expect(canvas.queryByText('Could not copy to clipboard')).toBeNull())
    } finally {
      if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard)
      else Reflect.deleteProperty(navigator, 'clipboard')
    }
  },
}
