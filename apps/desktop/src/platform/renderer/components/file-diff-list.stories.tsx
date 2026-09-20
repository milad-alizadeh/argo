import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { FileDiffList } from './file-diff-list'

const meta = {
  title: 'Components/File diff list',
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
    await userEvent.click(canvas.getByText('package.json'))
    await expect(packageCheckbox).toBeChecked()
    await expect(canvas.queryByText(/@playwright\/test/)).toBeNull()
  },
}
