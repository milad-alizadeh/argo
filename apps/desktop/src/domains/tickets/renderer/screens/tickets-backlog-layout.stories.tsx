import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { MemoryRouter } from 'react-router'
import { expect, fn, userEvent, within } from 'storybook/test'
import type { Ticket } from '@/domains/tickets/contract/contract'
import { CockpitShell } from '@/platform/renderer/cockpit/components/cockpit-shell'
import { TicketDetail } from '../detail/ticket-detail'
import { backlog, connection, standalone, wayfinder } from '../detail/ticket-fixtures'
import { TicketList } from '../sidebar/ticket-list'
import { TicketsSidebarHeader } from '../sidebar/tickets-sidebar-header'

const link = (key: string, title: string) => ({ key, title, state: 'open' as const })

const architecture: Ticket = {
  ...wayfinder,
  key: '#801',
  url: 'https://github.com/octocat/hello-world/issues/801',
  title:
    'Move the Ticket backlog into the shell sidebar without narrowing the issue description and linked work',
  body: 'The Ticket list belongs in the shell sidebar. The selected Ticket should use the full workspace for its description, relationships, and linked Sessions.',
  labels: [
    { name: 'desktop-layout', color: '5319e7' },
    { name: 'accessibility-review', color: 'a2eeef' },
  ],
  children: [
    link('#802', 'Keep nested Tickets legible in the narrower backlog'),
    link('#804', 'Move Ticket properties into the detail header'),
  ],
}

const nestedList: Ticket[] = [
  architecture,
  {
    ...standalone,
    key: '#802',
    url: 'https://github.com/octocat/hello-world/issues/802',
    title:
      'Keep nested Tickets legible when a child has a long title that needs more than one line',
    labels: [{ name: 'hierarchy', color: null }],
    children: [link('#803', 'Prove a third level still scans clearly')],
  },
  {
    ...standalone,
    key: '#803',
    url: 'https://github.com/octocat/hello-world/issues/803',
    title: 'Prove a third level still scans clearly without pushing the title into a sliver',
    labels: [],
    children: [],
  },
  {
    ...standalone,
    key: '#804',
    url: 'https://github.com/octocat/hello-world/issues/804',
    title: 'Move Ticket properties into the detail header and let them reflow with available space',
    labels: [{ name: 'detail', color: 'fbca04' }],
    children: [],
  },
  {
    ...standalone,
    key: '#805',
    url: 'https://github.com/octocat/hello-world/issues/805',
    title: 'Keep the unselected backlog useful while a detailed issue is open in the workspace',
    labels: [{ name: 'needs-triage', color: 'fbca04' }],
    children: [],
  },
]

const storyBacklog = backlog({ tickets: nestedList })

function TicketBacklogLayout({ width = '100%' }: { width?: string }) {
  const [selectedKey, setSelectedKey] = useState(architecture.key)
  const selected = nestedList.find((ticket) => ticket.key === selectedKey) ?? null
  return (
    <div className="h-dvh max-w-full" style={{ width }}>
      <MemoryRouter>
        <CockpitShell
          header={<span className="type-meta text-muted-foreground">octocat/hello-world</span>}
          sidebar={
            <aside aria-label="Tickets sidebar" className="flex h-full min-h-0 flex-col bg-sidebar">
              <TicketsSidebarHeader connection={connection('github')} />
              <TicketList
                backlog={storyBacklog}
                now={new Date('2026-09-25T12:00:00Z').getTime()}
                onSelect={setSelectedKey}
                placement="sidebar"
                selectedKey={selectedKey}
              />
            </aside>
          }
        >
          <main aria-label="Ticket detail" className="flex h-full min-h-0 flex-col bg-background">
            <TicketDetail
              linkedSessions={[]}
              listed={new Set(nestedList.map((ticket) => ticket.key))}
              onChangePriority={fn()}
              onChangeStatus={fn()}
              onOpenSession={fn()}
              onSelect={setSelectedKey}
              provider={storyBacklog.provider}
              statuses={storyBacklog.statuses}
              ticket={selected}
            />
          </main>
        </CockpitShell>
      </MemoryRouter>
    </div>
  )
}

const meta = {
  title: 'Tickets/Screen/Backlog sidebar',
  component: TicketBacklogLayout,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof TicketBacklogLayout>

export default meta
type Story = StoryObj<typeof TicketBacklogLayout>

function expectAlignedRowControls(backlogRegion: ReturnType<typeof within>) {
  const parentFold = backlogRegion.getByRole('button', { name: 'Collapse #801' })
  const parentStatus = backlogRegion.getAllByRole('button', { name: 'State: Open' })[0]
  const foldIcon = parentFold.querySelector('svg')
  const statusIcon = parentStatus?.querySelector('svg')
  if (foldIcon === null || statusIcon === null || statusIcon === undefined)
    throw new Error('The Ticket row controls need their icons.')
  const foldCenter =
    foldIcon.getBoundingClientRect().top + foldIcon.getBoundingClientRect().height / 2
  const statusCenter =
    statusIcon.getBoundingClientRect().top + statusIcon.getBoundingClientRect().height / 2
  expect(Math.abs(foldCenter - statusCenter)).toBeLessThanOrEqual(1)
}

async function expectCollapsedToggleClearsTitle(
  canvas: ReturnType<typeof within>,
  detailTitle: HTMLElement,
) {
  await userEvent.click(canvas.getByRole('button', { name: 'Collapse sidebar' }))
  const opener = await canvas.findByRole('button', { name: 'Open sidebar' })
  await expect(detailTitle.getBoundingClientRect().top).toBeGreaterThanOrEqual(
    opener.getBoundingClientRect().bottom,
  )
  await userEvent.click(opener)
}

async function expectFixedDetailChrome(canvasElement: HTMLElement) {
  const contentChrome = canvasElement.querySelector<HTMLElement>(
    'main[aria-label="Ticket detail"] [data-component="CockpitContentChrome"]',
  )
  const detailScroll = canvasElement.querySelector<HTMLElement>(
    'main[aria-label="Ticket detail"] [data-component="TicketDetailScroll"]',
  )
  if (contentChrome === null || detailScroll === null)
    throw new Error('The Ticket detail layout is absent.')
  await expect(detailScroll.getBoundingClientRect().top).toBeGreaterThanOrEqual(
    contentChrome.getBoundingClientRect().bottom,
  )
  await expect(getComputedStyle(detailScroll).overflowY).toBe('auto')
}

async function ensureSidebarOpen(canvas: ReturnType<typeof within>) {
  const opener = canvas.queryByRole('button', { name: 'Open sidebar' })
  if (opener) await userEvent.click(opener)
}

async function expectTicketMetadata(canvas: ReturnType<typeof within>) {
  const sourceLink = canvas.getByRole('link', { name: 'Open #801 in GitHub' })
  const properties = canvas.getByText('State').closest('dl')
  if (properties === null) throw new Error('The Ticket metadata is absent.')
  await expect(properties.contains(sourceLink)).toBe(true)
  const metadata = canvas.getByRole('complementary', { name: 'Ticket metadata' })
  const rail = within(metadata)
  await expect(getComputedStyle(metadata).flexDirection).toBe('column')
  await expect(rail.getByRole('heading', { name: 'Properties' })).toBeVisible()
  await expect(rail.getByRole('heading', { name: 'Labels' })).toBeVisible()
  await expect(rail.getByRole('heading', { name: 'Relations' })).toBeVisible()
  await expect(rail.getAllByText('Created').length).toBeGreaterThan(0)
  await expect(metadata.querySelector('time')).toHaveAttribute('datetime', architecture.createdAt)
  await expect(metadata).toHaveTextContent('Children · 0 of 2 closed')
  await expect(metadata).toHaveTextContent('Blocked by · 2')
  await expect(metadata).toHaveTextContent('Sessions0')
  const [child] = architecture.children
  if (!child) throw new Error('The fixture needs a child Ticket.')
  const relationTitle = rail.getByTitle(child.title)
  await expect(getComputedStyle(relationTitle).textOverflow).toBe('ellipsis')
  await expect(getComputedStyle(relationTitle).whiteSpace).toBe('nowrap')
  const labelBadge = rail.getByText('desktop-layout')
  await expect(labelBadge.parentElement?.closest('[data-slot="badge"]')).toBeNull()
}

export const NestedLongTitles: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await ensureSidebarOpen(canvas)
    const sidebarElement = await canvas.findByRole('complementary', { name: 'Tickets sidebar' })
    const sidebar = within(sidebarElement)
    const backlogRegion = within(sidebar.getByRole('region', { name: 'Backlog' }))
    const rows = backlogRegion.getAllByRole('button', { name: /^#\d+/ })
    await expect(rows.map((row) => row.textContent?.slice(0, 4))).toEqual([
      '#801',
      '#802',
      '#803',
      '#804',
      '#805',
    ])
    const longTitle = backlogRegion.getByText(nestedList[1]?.title ?? '')
    const lineHeight = Number.parseFloat(getComputedStyle(longTitle).lineHeight)
    await expect(longTitle.clientHeight).toBeGreaterThan(lineHeight)
    await expect(longTitle.clientHeight).toBeLessThanOrEqual(lineHeight * 2 + 1)
    await expect(backlogRegion.queryByText('hierarchy')).toBeNull()
    await expect(backlogRegion.queryByText('needs-triage')).toBeNull()
    await expect(sidebarElement.scrollWidth).toBeLessThanOrEqual(sidebarElement.clientWidth)
    await expect(canvas.getByRole('heading', { name: architecture.title })).toBeVisible()
    const sidebarTitle = sidebar.getByRole('heading', { name: 'Tickets' })
    const properties = canvas.getByText('State').closest('dl')
    if (properties === null) throw new Error('The Ticket detail needs its properties.')
    const detailTitle = canvas.getByRole('heading', { name: architecture.title })
    await expect(
      Math.abs(sidebarTitle.getBoundingClientRect().top - detailTitle.getBoundingClientRect().top),
    ).toBeLessThanOrEqual(1)
    const detailHeader = detailTitle.closest('header')
    if (detailHeader === null) throw new Error('The Ticket title needs a header.')
    await expect(getComputedStyle(detailHeader).borderBottomWidth).toBe('0px')
    await expectFixedDetailChrome(canvasElement)
    const detailLineHeight = Number.parseFloat(getComputedStyle(detailTitle).lineHeight)
    await expect(detailTitle.clientHeight).toBeLessThanOrEqual(detailLineHeight * 2 + 1)
    await expectTicketMetadata(canvas)
    const propertyBounds = properties.getBoundingClientRect()
    const titleBounds = detailTitle.getBoundingClientRect()
    await expect(
      propertyBounds.left > titleBounds.right || propertyBounds.top > titleBounds.bottom,
    ).toBe(true)
    expectAlignedRowControls(backlogRegion)
    await expectCollapsedToggleClearsTitle(canvas, detailTitle)
    await expect(rows[1]).toHaveAccessibleName(/child of #801$/)
    await expect(rows[2]).toHaveAccessibleName(/child of #802$/)
    await userEvent.click(canvas.getAllByRole('button', { name: /^#\d+/ })[1] as HTMLElement)
    await expect(canvas.getByRole('heading', { name: nestedList[1]?.title ?? '' })).toBeVisible()
  },
}

export const NarrowDetail: Story = {
  args: { width: '68rem' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const title = canvas.getByRole('heading', { name: architecture.title })
    const metadata = canvas.getByRole('complementary', { name: 'Ticket metadata' })
    await expect(metadata.getBoundingClientRect().top).toBeGreaterThan(
      title.getBoundingClientRect().bottom,
    )
    await expect(metadata.scrollWidth).toBeLessThanOrEqual(metadata.clientWidth)
    await expect(within(metadata).getByRole('button', { name: '2 children' })).toBeVisible()
    await expect(within(metadata).getByRole('button', { name: '2 blockers' })).toBeVisible()
  },
}
