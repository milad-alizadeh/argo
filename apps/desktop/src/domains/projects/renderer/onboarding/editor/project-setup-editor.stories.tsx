import type { Meta, StoryObj } from '@storybook/react-vite'
import { type ComponentProps, useState } from 'react'
import { expect, fireEvent, fn, userEvent, waitFor, within } from 'storybook/test'
import { ProjectSetupEditor } from './project-setup-editor'

const CONFIGURATION = JSON.stringify(
  { version: 1, targets: { app: { path: '.', enabled: true, test: 'bun test' } } },
  null,
  2,
)
const EDITED_CONFIGURATION = '{"version":1,"targets":{"app":{"enabled":false}}}'
const LONG_CONFIGURATION = JSON.stringify({
  version: 1,
  targets: { app: { path: 'packages/long-project-name/'.repeat(24), enabled: true } },
})

const meta = {
  title: 'Features/Projects/Onboarding/Configuration Editor',
  component: ProjectSetupEditor,
  args: { onChange: fn(), source: CONFIGURATION },
  render: (args) => <ControlledConfigurationEditor {...args} />,
  decorators: [
    (Story) => (
      <div className="max-w-2xl p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProjectSetupEditor>

export default meta
type Story = StoryObj<typeof meta>

function ControlledConfigurationEditor(props: ComponentProps<typeof ProjectSetupEditor>) {
  const [source, setSource] = useState(props.source)
  return (
    <div className="space-y-4">
      <ProjectSetupEditor
        source={source}
        onChange={(nextSource) => {
          props.onChange(nextSource)
          setSource(nextSource)
        }}
      />
      <button type="button">Continue setup</button>
    </div>
  )
}

function selectConfiguration() {
  const modifier = navigator.platform.startsWith('Mac') ? 'Meta' : 'Control'
  return userEvent.keyboard(`{${modifier}>}a{/${modifier}}`)
}

export const EditingAndSelection: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const editor = canvas.getByRole('textbox', { name: 'Project configuration' })
    await userEvent.tab()
    await expect(editor).toHaveFocus()
    await selectConfiguration()
    await userEvent.paste(EDITED_CONFIGURATION)
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith(EDITED_CONFIGURATION))
    await expect(editor).toHaveTextContent(EDITED_CONFIGURATION)
    await expect(editor).not.toHaveAttribute('aria-invalid')
    await selectConfiguration()
    await userEvent.keyboard('{ArrowRight}')
    await userEvent.keyboard(' ')
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith(`${EDITED_CONFIGURATION} `))
    fireEvent.keyDown(editor, { key: 'Escape', code: 'Escape', keyCode: 27 })
    await expect(fireEvent.keyDown(editor, { key: 'Tab', code: 'Tab', keyCode: 9 })).toBe(true)
    await expect(args.onChange).toHaveBeenLastCalledWith(`${EDITED_CONFIGURATION} `)
  },
}

export const InvalidConfiguration: Story = {
  args: { source: '{"enabled":}' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const editor = canvas.getByRole('textbox', { name: 'Project configuration' })
    await expect(editor).toHaveAttribute('aria-invalid', 'true')
    await expect(editor).toHaveAccessibleDescription('Enter valid JSON.')
    await userEvent.click(editor)
    await selectConfiguration()
    await userEvent.paste(EDITED_CONFIGURATION)
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith(EDITED_CONFIGURATION))
    await expect(editor).not.toHaveAttribute('aria-invalid')
    await expect(editor).not.toHaveAttribute('aria-describedby')
    await expect(editor).toHaveFocus()
  },
}

export const LongConfiguration: Story = {
  args: { source: LONG_CONFIGURATION },
  tags: ['view-only'],
}
