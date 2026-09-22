import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { ComposerStory } from '../editor'
import { useComposerStore } from '../hooks'

const FRAME = 'mx-auto max-w-4xl p-8'
const CONTEXT_PICKER_FRAME = 'mx-auto mt-72 max-w-4xl p-8 pt-96'

// Files and folders stay on the native attachment path, reached through the shared picker.
async function attachViaMenu(canvas: ReturnType<typeof within>) {
  await userEvent.click(canvas.getByRole('button', { name: 'Add context' }))
  const picker = await within(document.body).findByRole('dialog', { name: 'Context picker' })
  await userEvent.click(within(picker).getByRole('button', { name: 'Files & folders' }))
}

// Stands in for the native chooser, the drop handler's path resolution and the send-time
// readability check, all otherwise reached only through the Electron context bridge.
function mockAttachmentsHost({
  chosenPaths = [],
  readablePaths,
}: {
  chosenPaths?: string[]
  readablePaths?: (paths: string[]) => string[]
} = {}) {
  const before = window.argo
  window.argo = {
    ...before,
    chooseSessionAttachments: async () => ({
      version: 1,
      type: 'session.attachments.chosen',
      requestId: 'storybook-attachments-choose',
      paths: chosenPaths,
    }),
    statSessionAttachments: async ({ paths }) => {
      const readable = new Set(readablePaths ? readablePaths(paths) : paths)
      return {
        version: 1,
        type: 'session.attachments.statted',
        requestId: 'storybook-attachments-stat',
        files: paths.map((path) => ({ path, readable: readable.has(path) })),
      }
    },
    pathForFile: (file) => `/dropped/${file.name}`,
  }
  return () => {
    window.argo = before
  }
}

// The Storybook `play` run happens in a real browser, where `DataTransfer` must be a genuine
// instance: a plain `{ files: [...] }` object throws constructing the DragEvent (#1845).
function fileDataTransfer(names: string[]) {
  const dataTransfer = new DataTransfer()
  for (const name of names) dataTransfer.items.add(new File(['content'], name))
  return dataTransfer
}

const meta = {
  title: 'Sessions/Composer/Attachments',
  component: ComposerStory,
  decorators: [
    (Story, { parameters }) => (
      <div className={(parameters.frame as string | undefined) ?? FRAME}>
        <Story />
      </div>
    ),
  ],
  // Drafts outlive a story like they outlive a page, so each story starts from none.
  beforeEach: () => {
    useComposerStore.setState(useComposerStore.getInitialState())
  },
} satisfies Meta<typeof ComposerStory>

export default meta
type Story = StoryObj<typeof ComposerStory>

export const AttachViaButton: Story = {
  beforeEach: () => mockAttachmentsHost({ chosenPaths: ['/repo/notes.md'] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await attachViaMenu(canvas)
    await expect(await canvas.findByText('notes')).toBeVisible()
    await expect(canvas.getByText('MD file')).toBeVisible()
  },
}

export const SharedContextPicker: Story = {
  parameters: { frame: CONTEXT_PICKER_FRAME },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('button', { name: 'Add context' }))
    const picker = await within(document.body).findByRole('dialog', { name: 'Context picker' })
    await expect(within(picker).getByRole('button', { name: 'Files & folders' })).toHaveFocus()
    await expect(within(picker).getByText('ENG-42')).toBeVisible()
    await expect(within(picker).queryByText('ENG-9')).toBeNull()
    await expect(within(picker).getByRole('button', { name: /Goals.*Coming soon/ })).toBeDisabled()

    await userEvent.click(within(picker).getByRole('button', { name: /ENG-42.*Keep the Composer/ }))
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-ticket-key="ENG-42"]')).not.toBeNull(),
    )
    await expect(canvas.getByLabelText('Message')).toHaveFocus()
  },
}

export const ImageAttachmentShowsAPreview: Story = {
  beforeEach: () =>
    mockAttachmentsHost({ chosenPaths: ['/repo/notes.md', '/repo/screenshot.png'] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await attachViaMenu(canvas)
    await canvas.findByText('notes')
    await expect(canvas.getByAltText('')).toHaveAttribute(
      'src',
      'argo-attachment://local/repo/screenshot.png',
    )
    await expect(canvas.getByText('MD file')).toBeVisible()
    const attachmentGroup = canvasElement.querySelector('[data-slot="attachment-group"]')
    if (attachmentGroup === null) throw new Error('Attachment group did not render')
    await expect(attachmentGroup.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      canvas.getByLabelText('Message').getBoundingClientRect().top,
    )
  },
}

export const RemovingAnAttachmentKeepsTheDraft: Story = {
  beforeEach: () => mockAttachmentsHost({ chosenPaths: ['/repo/notes.md'] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')

    await userEvent.click(composer)
    await userEvent.type(composer, 'Half a thought.')
    await attachViaMenu(canvas)
    await canvas.findByText('notes')
    await userEvent.click(canvas.getByRole('button', { name: 'Remove notes' }))

    await expect(canvas.queryByText('notes')).toBeNull()
    await expect(composer).toHaveTextContent('Half a thought.')
  },
}

export const AttachmentSurvivesASessionSwitch: Story = {
  beforeEach: () => mockAttachmentsHost({ chosenPaths: ['/repo/notes.md'] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await attachViaMenu(canvas)
    await canvas.findByText('notes')
    await userEvent.click(canvas.getByRole('button', { name: 'Session two' }))
    await expect(canvas.queryByText('notes')).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Session one' }))
    await expect(await canvas.findByText('notes')).toBeVisible()
  },
}

export const DragAndDropAttaches: Story = {
  beforeEach: () => mockAttachmentsHost(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')
    const dropTarget = composer.closest('form')?.querySelector('.rounded-xl')

    if (!dropTarget) throw new Error('Composer card is missing.')
    // `fireEvent.drop`'s dataTransfer support copies only the given object's own enumerable
    // properties onto a fresh DataTransfer; a real DataTransfer instance keeps `files`/`items`
    // behind prototype getters, so that copy silently drops them. Dispatch the DragEvent directly
    // instead, with the real DataTransfer attached as the browser constructs it (#1845).
    dropTarget.dispatchEvent(
      new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: fileDataTransfer(['diagram.jpg']),
      }),
    )

    await expect(await canvas.findByText('diagram')).toBeVisible()
    await expect(canvas.getByAltText('')).toHaveAttribute(
      'src',
      'argo-attachment://local/dropped/diagram.jpg',
    )
  },
}

export const FailedAttachmentStaysAfterSend: Story = {
  beforeEach: () =>
    mockAttachmentsHost({
      chosenPaths: ['/repo/notes.md', '/repo/gone.md'],
      readablePaths: (paths) => paths.filter((path) => path !== '/repo/gone.md'),
    }),
  render: () => <ComposerStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByLabelText('Message')

    await userEvent.click(composer)
    await userEvent.type(composer, 'Review these.')
    await attachViaMenu(canvas)
    await canvas.findByText('notes')
    await userEvent.click(canvas.getByRole('button', { name: 'Send message' }))

    await expect(canvas.getByTestId('sent-message')).toHaveTextContent(
      'Review these. @/repo/notes.md',
    )
    await expect(await canvas.findByText('Not found')).toBeVisible()
    await expect(canvas.getByText('gone')).toBeVisible()
  },
}
