import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import type { Provider } from '@/domains/accounts/contract/contract'
import type { Ticket, TicketPriority, TicketStatus } from '@/domains/tickets/contract/contract'
import { ticketAge } from '@/domains/tickets/contract/ticket-age'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { Badge } from '@/platform/renderer/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/platform/renderer/components/ui/popover'
import { type BacklogRow, closedChildren, openBlockers } from '../lib/backlog'
import type { SourcePresentation } from '../lib/sources'
import { PriorityMenu } from '../status/priority-menu'
import { StatusMenu } from '../status/status-menu'
import { TicketLabel } from '../status/ticket-label'
import { TreeRails, TreeStem, TreeTwig } from './tree-lines'

const markIcon = 'size-(--size-icon-meta) shrink-0'
type TreeAnchorStyle = CSSProperties & Record<'--ticket-tree-anchor', string>
const treeAnchor: TreeAnchorStyle = {
  '--ticket-tree-anchor':
    'calc(var(--spacing-shell-icon) + var(--text-body--line-height) / 2 + 1px)',
}
const sidebarTreeAnchor: TreeAnchorStyle = {
  '--ticket-tree-anchor': 'calc(var(--spacing-shell-item) + var(--text-body--line-height) / 2)',
}
// Past this many, the rest of a row's labels are counted rather than drawn.
const SHOWN_LABELS = 2
const SHOWN_RAIL_LABELS = 3
const CATEGORY_LABELS = new Set(['bug', 'implementation', 'enhancement'])

// Blocking is workflow state, not taxonomy: it sits beside the title instead of among labels.
function BlockedMark({ ticket }: { ticket: Ticket }) {
  const { t } = useTranslation('tickets')
  const blockers = openBlockers(ticket)
  if (blockers === 0) return null
  return (
    <span className="inline-flex shrink-0 items-center text-destructive">
      <Icon aria-hidden name="blocked" className={markIcon} />
      <span className="sr-only">{t('row.blockedBy', { count: blockers })}</span>
    </span>
  )
}

function Labels({ labels, stacked = false }: { labels: Ticket['labels']; stacked?: boolean }) {
  const { t } = useTranslation('tickets')
  if (labels.length === 0) return null
  const hidden = labels.length - SHOWN_LABELS
  return (
    <span
      className={
        stacked
          ? 'flex min-w-0 flex-nowrap items-center -space-x-2 overflow-hidden'
          : 'flex shrink-0 items-center gap-(--spacing-shell-tight)'
      }
    >
      {labels.slice(0, SHOWN_LABELS).map((label) => (
        <TicketLabel key={label.name} label={label} />
      ))}
      {hidden > 0 ? (
        <span className="type-meta text-faint">
          <span aria-hidden="true">+{hidden}</span>
          <span className="sr-only">{t('row.moreLabels', { count: hidden })}</span>
        </span>
      ) : null}
    </span>
  )
}

function categoryAndLabels(ticket: Ticket) {
  const labelledCategory = ticket.labels.find((label) =>
    CATEGORY_LABELS.has(label.name.toLocaleLowerCase()),
  )
  const type = ticket.type?.trim() ?? ''
  const category = labelledCategory ?? (type === '' ? null : { name: type, color: null })
  const labels = ticket.labels.filter(
    (label) =>
      label !== labelledCategory &&
      (type === '' || label.name.toLocaleLowerCase() !== type.toLocaleLowerCase()),
  )
  return { category, labels }
}

type TagRailProps = {
  all: Ticket['labels']
  category: Ticket['labels'][number] | null
  className: string
  labels: Ticket['labels']
  limit: number
  ticket: Ticket
}

function TagRail({ all, category, className, labels, limit, ticket }: TagRailProps) {
  const { t } = useTranslation('tickets')
  const shown = labels.slice(0, limit)
  const hidden = labels.length - shown.length
  if (hidden === 0) {
    return (
      <span className={`${className} min-w-0 items-center gap-(--spacing-shell-tight)`}>
        {all.map((label) => (
          <TicketLabel key={label.name} label={label} />
        ))}
      </span>
    )
  }
  return (
    <span className={`${className} min-w-0 max-w-full items-center gap-(--spacing-shell-tight)`}>
      {category === null ? null : <TicketLabel label={category} />}
      <Popover>
        <PopoverTrigger
          openOnHover
          render={
            <button
              aria-label={t('row.showMoreLabels', { count: hidden, key: ticket.key })}
              className="relative z-20 flex min-w-0 max-w-full items-center gap-(--spacing-shell-tight) rounded-full outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
              type="button"
            />
          }
        >
          <span className="flex min-w-0 items-center gap-(--spacing-shell-tight) overflow-hidden py-px">
            {shown.map((label) => (
              <TicketLabel key={label.name} label={label} />
            ))}
          </span>
          <Badge variant="secondary">{t('row.hiddenLabels', { count: hidden })}</Badge>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          aria-label={t('row.labelsFor', { key: ticket.key })}
          className="w-80"
        >
          <div className="flex flex-wrap gap-(--spacing-shell-tight)">
            {all.map((label) => (
              <TicketLabel key={label.name} label={label} />
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </span>
  )
}

// The category remains readable while secondary labels stay on one line. Compact rows reserve
// more room for the title; the overflow control appears only when this row actually hides labels.
function CategoryTagRail({ ticket }: { ticket: Ticket }) {
  const { category, labels } = categoryAndLabels(ticket)
  const all = category === null ? labels : [category, ...labels]
  if (all.length === 0) return null
  return (
    <>
      <TagRail
        all={all}
        category={category}
        className="flex @[44rem]:hidden"
        labels={labels}
        limit={1}
        ticket={ticket}
      />
      <TagRail
        all={all}
        category={category}
        className="hidden @[44rem]:flex"
        labels={labels}
        limit={SHOWN_RAIL_LABELS}
        ticket={ticket}
      />
    </>
  )
}

// A parent's chevron folds the rows drawn under it. A row with none keeps the chevron's width, so
// every title at one depth starts on one line.
function Fold({ row, folded, onToggle }: Pick<TicketRowProps, 'row' | 'folded' | 'onToggle'>) {
  const { t } = useTranslation('tickets')
  if (!row.nested) {
    return (
      <span aria-hidden="true" className="relative w-(--size-icon-control) shrink-0 self-stretch">
        {row.depth > 0 ? <TreeTwig /> : null}
      </span>
    )
  }
  const { key } = row.ticket
  return (
    <button
      aria-expanded={!folded}
      aria-label={folded ? t('row.expand', { key }) : t('row.collapse', { key })}
      className="relative z-10 flex w-(--size-icon-control) shrink-0 items-start justify-center self-stretch rounded-row pt-[calc(var(--ticket-tree-anchor)-var(--size-icon-meta)/2)] text-faint hover:text-foreground"
      onClick={onToggle}
      type="button"
    >
      <Icon
        name="chevron-right"
        className={`${markIcon} transition-transform ${folded ? '' : 'rotate-90'}`}
      />
      {folded ? null : <TreeStem />}
    </button>
  )
}

type TicketRowProps = {
  row: BacklogRow
  // The tree lines this row draws, one per ancestor column.
  rails: readonly boolean[]
  presentation: Pick<SourcePresentation, 'keyColumn' | 'statusNoun'>
  provider: Provider
  statuses: readonly TicketStatus[]
  selected: boolean
  folded: boolean
  placement: 'workspace' | 'sidebar'
  now: number
  onSelect: () => void
  onToggle: () => void
  onChangeStatus: (status: TicketStatus) => void
  onChangePriority: (priority: TicketPriority | null) => void
}

function SidebarMetadata(props: TicketRowProps) {
  const { ticket } = props.row
  const age = ticketAge(ticket.createdAt, props.now)
  return (
    <>
      <div className="col-start-2 mt-(--spacing-shell-tight) flex min-w-0 items-center gap-(--spacing-shell-item)">
        {props.provider === 'linear' ? (
          <span className="relative z-10 flex shrink-0 items-center">
            <PriorityMenu
              named={false}
              onChange={props.onChangePriority}
              priority={ticket.priority}
            />
          </span>
        ) : null}
        <span aria-hidden="true" className="shrink-0 type-meta text-faint">
          {ticket.key}
        </span>
        <time className="shrink-0 type-meta text-faint tabular-nums" dateTime={ticket.createdAt}>
          <span aria-hidden="true">{age.short}</span>
          <span className="sr-only">{age.long}</span>
        </time>
      </div>
      <div className="col-start-2 mt-(--spacing-shell-tight) min-w-0">
        <Labels labels={ticket.labels} stacked />
      </div>
    </>
  )
}

function SidebarTicketRow(props: TicketRowProps) {
  const { t } = useTranslation('tickets')
  const { row, rails, presentation, statuses, selected, folded } = props
  const { onSelect, onToggle, onChangeStatus } = props
  const { ticket, parent } = row
  return (
    <div className="relative flex min-w-0 items-stretch gap-(--spacing-shell-tight) rounded-row px-(--spacing-shell-item) hover:bg-muted has-[[aria-current]]:bg-selected">
      <span className="flex shrink-0 self-stretch" style={sidebarTreeAnchor}>
        <TreeRails rails={rails} />
        <Fold folded={folded} onToggle={onToggle} row={row} />
      </span>
      <div className="min-w-0 flex-1 py-(--spacing-shell-item)">
        <div className="grid min-w-0 grid-cols-[var(--size-icon-meta)_minmax(0,1fr)] items-start gap-x-(--spacing-shell-tight)">
          <span className="relative z-10 flex h-(--text-body--line-height) shrink-0 items-center justify-center">
            <StatusMenu
              current={ticket.children.length > 0 ? closedChildren(ticket) : undefined}
              named={false}
              noun={presentation.statusNoun}
              onChange={onChangeStatus}
              status={ticket.status}
              statuses={statuses}
              total={ticket.children.length || undefined}
            />
          </span>
          <button
            aria-current={selected ? 'true' : undefined}
            className="flex min-w-0 flex-1 items-start gap-(--spacing-shell-tight) text-left outline-none after:absolute after:inset-0 after:rounded-row focus-visible:after:outline-2 focus-visible:after:outline-ring focus-visible:after:-outline-offset-2"
            onClick={onSelect}
            type="button"
          >
            <span className="sr-only">{ticket.key} </span>
            <span className="min-w-0 line-clamp-2 type-body font-medium" title={ticket.title}>
              {ticket.title}
            </span>
            <BlockedMark ticket={ticket} />
            {parent === null ? null : (
              <span className="sr-only">{t('row.childOf', { parent })}</span>
            )}
          </button>
          <SidebarMetadata {...props} />
        </div>
      </div>
    </div>
  )
}

// The row selects wherever it is pressed but on its status and its chevron: the select button's
// overlay covers the row, and those two sit above it. The overlay draws the button's ring, so the
// keyboard cursor outlines the whole row. The key column keeps parent and child titles aligned.
function WorkspaceTicketRow(props: TicketRowProps) {
  const { t } = useTranslation('tickets')
  const { row, rails, presentation, provider, statuses, selected, folded, now } = props
  const { onSelect, onToggle, onChangeStatus, onChangePriority } = props
  const { ticket, parent } = row
  const age = ticketAge(ticket.createdAt, now)
  return (
    <div className="relative flex min-w-0 items-start gap-(--spacing-shell-tight) rounded-row px-(--spacing-shell-item) hover:bg-muted has-[[aria-current]]:bg-selected">
      {provider === 'linear' ? (
        <span className="mt-1 flex w-6 shrink-0 items-center justify-center">
          <PriorityMenu named={false} onChange={onChangePriority} priority={ticket.priority} />
        </span>
      ) : null}
      <span
        aria-hidden="true"
        className={`${presentation.keyColumn} mt-(--spacing-shell-icon) shrink-0 translate-y-px type-body text-faint`}
      >
        {ticket.key}
      </span>
      <span className="relative z-10 mt-(--spacing-shell-icon) flex h-(--text-body--line-height) shrink-0 translate-y-px items-center gap-(--spacing-shell-tight) type-meta text-muted-foreground tabular-nums">
        <StatusMenu
          current={ticket.children.length > 0 ? closedChildren(ticket) : undefined}
          named={false}
          noun={presentation.statusNoun}
          onChange={onChangeStatus}
          status={ticket.status}
          statuses={statuses}
          total={ticket.children.length || undefined}
        />
        {ticket.children.length > 0 ? (
          <span className="sr-only">
            {t('row.childrenClosed', {
              closed: closedChildren(ticket),
              count: ticket.children.length,
            })}
          </span>
        ) : null}
      </span>
      <span className="flex shrink-0 self-stretch" style={treeAnchor}>
        <TreeRails rails={rails} />
        <Fold folded={folded} onToggle={onToggle} row={row} />
      </span>
      <div className="@container flex min-w-0 flex-1 flex-wrap items-center gap-(--spacing-shell-item) py-(--spacing-shell-icon) text-left @[44rem]:flex-nowrap">
        <button
          aria-current={selected ? 'true' : undefined}
          className="order-1 flex min-w-0 flex-1 items-center gap-(--spacing-shell-tight) text-left type-body outline-none after:absolute after:inset-0 after:rounded-row focus-visible:after:outline-2 focus-visible:after:outline-ring focus-visible:after:-outline-offset-2"
          onClick={onSelect}
          title={ticket.title}
          type="button"
        >
          <span className="sr-only">{ticket.key} </span>
          <span className="min-w-0 truncate">{ticket.title}</span>
          <BlockedMark ticket={ticket} />
          {parent === null ? null : <span className="sr-only">{t('row.childOf', { parent })}</span>}
        </button>
        <span className="relative z-10 order-3 flex min-w-0 basis-full @[44rem]:order-2 @[44rem]:basis-auto">
          <CategoryTagRail ticket={ticket} />
        </span>
        <time
          className="relative z-10 order-4 hidden w-(--size-ticket-age) shrink-0 text-right type-meta text-faint tabular-nums @[var(--size-ticket-age-visible)]:block"
          dateTime={ticket.createdAt}
        >
          <span aria-hidden="true">{age.short}</span>
          <span className="sr-only">{age.long}</span>
        </time>
      </div>
    </div>
  )
}

export function TicketRow(props: TicketRowProps) {
  return props.placement === 'sidebar' ? (
    <SidebarTicketRow {...props} />
  ) : (
    <WorkspaceTicketRow {...props} />
  )
}
