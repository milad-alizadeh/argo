import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { FileDiffList } from './file-diff-list'

const meta = {
  title: 'Design System/Patterns/File Diff List',
  component: FileDiffList,
  args: {
    accessibleName: 'Setup file changes',
    files: [
      {
        path: 'package.json',
        diff: '@@ -10,2 +10,3 @@\n "devDependencies": {\n+  "@playwright/test": "latest"\n }',
      },
      {
        path: 'apps/desktop/biome.jsonc',
        diff: '@@ -3,2 +3,2 @@\n-  "enabled": false\n+  "enabled": true',
      },
    ],
    markViewedLabel: (path: string) => `Mark ${path} as viewed`,
    viewedLabel: 'Viewed',
  },
  decorators: [
    (Story) => (
      <div className="h-80 p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FileDiffList>

export default meta
type Story = StoryObj<typeof meta>

export const ReviewFiles: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const packageCheckbox = canvas.getByRole('checkbox', {
      name: 'Mark package.json as viewed',
    })
    await expect(packageCheckbox).not.toBeChecked()
    await expect(canvas.getByText(/@playwright\/test/)).toBeVisible()
    await expect(canvas.getByText(/^-\s+"enabled": false$/)).toBeVisible()
    await expect(canvas.getByText(/^\+\s+"enabled": true$/)).toBeVisible()
    const packageFile = canvas.getByRole('region', { name: 'package.json' })
    await expect(
      [...packageFile.querySelectorAll('pre [aria-hidden="true"]')].map((line) => line.textContent),
    ).toEqual(['10', '11', '12'])
    await userEvent.click(canvas.getByText('package.json'))
    await expect(packageCheckbox).toBeChecked()
    await expect(canvas.queryByText(/@playwright\/test/)).toBeNull()
  },
}

export const EmbeddedReview: Story = {
  args: {
    variant: 'embedded',
    files: [
      {
        path: 'package.json',
        diff: '@@ -4,2 +4,2 @@\n scripts:\n-use the old test runner\n+install the test runner',
      },
      { path: 'apps/desktop/שלום/مراجعة/測定.ts', diff: '+export const enabled = true' },
    ],
  },
  render: (args) => (
    <aside
      role="presentation"
      className="panel-sidebar panel-outer-start panel-outer-end h-full border border-border"
    >
      <FileDiffList {...args} className="min-h-0 flex-1" />
    </aside>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const packageCheckbox = canvas.getByRole('checkbox', { name: 'Mark package.json as viewed' })
    await expect(canvas.getByText('apps/desktop/שלום/مراجعة/測定.ts')).toBeVisible()
    await expect(canvas.getByText('scripts:')).toBeVisible()
    await expect(canvas.getByText('-use the old test runner')).toBeVisible()
    await expect(canvas.getByText(/install the test runner/)).toBeVisible()
    const packageFile = canvas.getByRole('region', { name: 'package.json' })
    await expect(
      [...packageFile.querySelectorAll('pre [aria-hidden="true"]')].map((line) => line.textContent),
    ).toEqual(['4', '5', '5'])
    await userEvent.click(canvas.getByText('package.json'))
    await expect(packageCheckbox).toBeChecked()
    await expect(packageCheckbox).toHaveFocus()
    await expect(canvas.queryByText(/install the test runner/)).toBeNull()
    await expect(canvas.getByText(/export const enabled/)).toBeVisible()
    await userEvent.keyboard(' ')
    await expect(packageCheckbox).not.toBeChecked()
    await expect(canvas.getByText(/install the test runner/)).toBeVisible()
  },
}
