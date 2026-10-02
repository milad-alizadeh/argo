import type { Meta, StoryObj } from '@storybook/react-vite'
import * as React from 'react'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { Button } from '../../components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover'
import { AppPageHeader, AppShell } from './app-shell'

const sidebarRows = Array.from({ length: 40 }, (_, index) => `Sidebar row ${index + 1}`)

export function AppShellStoryComposition({ children }: { children?: React.ReactNode }) {
  const sidebarScrollRef = React.useRef<HTMLElement>(null)
  React.useEffect(() => {
    sidebarScrollRef.current?.setAttribute('tabindex', '0')
  }, [])
  const sidebar = (
    <aside aria-label="Workspace sidebar" className="flex h-full min-h-0 flex-col">
      <section
        ref={sidebarScrollRef}
        aria-label="Sidebar rows"
        className="sidebar-gutter min-h-0 flex-1 overflow-auto"
      >
        {sidebarRows.map((row) => (
          <p key={row} className="py-2">
            {row}
          </p>
        ))}
      </section>
    </aside>
  )
  return (
    <AppShell
      rail={<nav aria-label="Navigation rail" className="h-full" />}
      sidebar={sidebar}
      leftHeader={<span className="type-meta">Project</span>}
    >
      {children ?? (
        <>
          <AppPageHeader>
            <span>Workspace controls</span>
          </AppPageHeader>
          <div className="panel-content">
            <section
              className="flex min-h-0 flex-1 flex-col overflow-auto p-3"
              aria-label="Pane content"
            >
              <h1 className="type-heading">Workspace content</h1>
              <div className="mt-auto self-end">
                <Popover>
                  <PopoverTrigger render={<Button variant="outline" />}>
                    Corner popup
                  </PopoverTrigger>
                  <PopoverContent aria-label="Corner details">
                    <p>Popup outside the rounded pane</p>
                  </PopoverContent>
                </Popover>
              </div>
            </section>
          </div>
        </>
      )}
    </AppShell>
  )
}

async function collapseAndRestore(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  await userEvent.click(canvas.getByRole('button', { name: 'Collapse sidebar' }))
  const opener = await canvas.findByRole('button', { name: 'Open sidebar' })
  await waitFor(() => expect(opener).toBeVisible())
  await waitFor(() => expect(opener).toHaveFocus())
  await userEvent.click(opener)
  await waitFor(() =>
    expect(canvas.getByRole('button', { name: 'Collapse sidebar' })).toHaveFocus(),
  )
}

async function keyboardResize(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  const separator = canvas.getByRole('separator')
  separator.focus()
  await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowLeft}')
  await expect(separator).toHaveFocus()
  await expect(separator).toHaveAttribute('aria-orientation', 'vertical')
}

async function cornerPopup(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  const trigger = canvas.getByRole('button', { name: 'Corner popup' })
  await userEvent.click(trigger)
  await waitFor(() =>
    expect(within(document.body).getByText('Popup outside the rounded pane')).toBeVisible(),
  )
  await userEvent.keyboard('{Escape}')
  await waitFor(() => expect(trigger).toHaveFocus())
}

const meta = {
  title: 'App/Shell/Application Shell',
  component: AppShellStoryComposition,
  excludeStories: ['AppShellStoryComposition'],
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="h-dvh w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AppShellStoryComposition>
export default meta
type Story = StoryObj<typeof meta>

export const Expanded: Story = { tags: ['view-only'] }
export const Collapsed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Collapse sidebar' }))
    await expect(canvas.getByRole('button', { name: 'Open sidebar' })).toHaveFocus()
  },
}
export const CollapseRestore: Story = {
  play: ({ canvasElement }) => collapseAndRestore(canvasElement),
}
export const KeyboardResized: Story = { play: ({ canvasElement }) => keyboardResize(canvasElement) }
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="h-full w-[860px]">
        <Story />
      </div>
    ),
  ],
  play: ({ canvasElement }) => collapseAndRestore(canvasElement),
}
export const WideCornerPopup: Story = {
  decorators: [
    (Story) => (
      <div className="h-full w-[1280px]">
        <Story />
      </div>
    ),
  ],
  play: ({ canvasElement }) => cornerPopup(canvasElement),
}
