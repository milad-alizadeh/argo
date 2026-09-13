import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { roleColors } from './appearanceProbe'
import { FeedMarkdown } from './FeedMarkdown'
import { RICH_MARKDOWN, SAMPLE_PICTURE } from './feedSamples'

const meta: Meta<typeof FeedMarkdown> = {
  title: 'Sessions/Feed/Markdown',
  component: FeedMarkdown,
  decorators: [
    (Story) => (
      <div className="max-w-2xl p-6">
        <Story />
      </div>
    ),
  ],
  args: { text: RICH_MARKDOWN },
}

export default meta
type Story = StoryObj<typeof FeedMarkdown>

async function proveFormatted(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  await expect(canvas.getByText('one surface').tagName).toBe('STRONG')
  const heading = canvas.getByRole('heading', { name: 'What changed' })
  await expect(heading).toBeVisible()
  await expect(getComputedStyle(heading).fontWeight).toBe('500')
  const table = canvas.getByRole('table')
  await expect(table).toHaveTextContent('Narrow windowControls stay visiblePassed')
  const [, firstBodyRow] = within(table).getAllByRole('row')
  await expect(getComputedStyle(firstBodyRow ?? table).borderTopWidth).toBe('1px')
  const restored = canvas.getByRole('checkbox', { name: 'Draft restored' })
  await expect(restored).toBeChecked()
  await expect(restored).toHaveAttribute('tabindex', '-1')
  await expect(canvas.getByRole('checkbox', { name: 'Narrow layout review' })).not.toBeChecked()
  const inlineCode = canvas.getByText('editable')
  await expect(inlineCode.tagName).toBe('CODE')
  await expect(getComputedStyle(inlineCode).backgroundColor).toBe(
    roleColors('bg-muted').backgroundColor,
  )
  await expect(getComputedStyle(canvasElement.querySelector('blockquote') ?? table).color).toBe(
    roleColors('text-muted-foreground').color,
  )
  await expect(canvas.getByRole('img', { name: 'TypeScript file' })).toBeVisible()
  await expect(canvas.getByRole('img', { name: 'Code file' })).toBeVisible()
  await expect(canvas.getByRole('separator')).toBeInTheDocument()
}

export const Formatted: Story = {
  play: ({ canvasElement }) => proveFormatted(canvasElement),
}

export const FormattedLight: Story = {
  globals: { theme: 'light' },
  play: ({ canvasElement }) => proveFormatted(canvasElement),
}

export const RawHtmlStaysText: Story = {
  args: {
    text: 'Before <script>window.feedHacked = true</script> and <img src="x" onerror="window.feedHacked = true"> after.',
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement).toHaveTextContent('<script>window.feedHacked = true</script>')
    await expect(canvasElement.querySelector('script, img')).toBeNull()
    await expect((window as { feedHacked?: boolean }).feedHacked).toBeUndefined()
  },
}

export const Links: Story = {
  args: {
    text: 'Read [the ticket](https://github.com/milad-alizadeh/argo/issues/1835), [write to us](mailto:reader@example.com), [run this](javascript:alert(1)) or [a local note](docs/note.md).',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const links = canvas.getAllByRole('link')
    await expect(links.map((link) => link.textContent)).toEqual(['the ticket', 'write to us'])
    await expect(canvas.getByRole('link', { name: 'the ticket' })).toHaveAttribute(
      'target',
      '_blank',
    )
    await expect(canvas.getByText('run this').tagName).toBe('SPAN')
    await expect(canvas.getByText('a local note').tagName).toBe('SPAN')
  },
}

// Tab reaches each link that opens and skips each target drawn as text.
export const LinksFromKeyboard: Story = {
  args: Links.args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.tab()
    await expect(canvas.getByRole('link', { name: 'the ticket' })).toHaveFocus()
    await userEvent.tab()
    await expect(canvas.getByRole('link', { name: 'write to us' })).toHaveFocus()
    await userEvent.tab()
    await expect(canvasElement.contains(document.activeElement)).toBe(false)
  },
}

export const Images: Story = {
  args: {
    text: `Two images in one row:\n\n![The attached reference](${SAMPLE_PICTURE}) ![A file the Session moved](shots/missing.png)\n\nAnd one inside a sentence: ![A second reference](${SAMPLE_PICTURE}) there.`,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const galleries = canvasElement.querySelectorAll('[data-component="FeedGallery"]')
    await expect(galleries).toHaveLength(2)
    await expect(galleries[0]).toHaveTextContent('Image unavailable')
    await waitFor(() =>
      expect(
        canvas.getByRole('button', { name: 'Open The attached reference in lightbox' }),
      ).toHaveAttribute('data-state', 'loaded'),
    )
    await expect(canvasElement.querySelector('p [data-component="FeedGallery"]')).toBeNull()
  },
}
