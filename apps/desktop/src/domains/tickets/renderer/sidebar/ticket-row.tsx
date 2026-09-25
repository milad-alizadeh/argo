import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import type { Provider } from '@/domains/accounts/contract/contract'
import type { Ticket, TicketPriority, TicketStatus } from '@/domains/tickets/contract/contract'
import { ticketAge } from '@/domains/tickets/contract/ticket-age'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { type BacklogRow, closedChildren, openBlockers } from '../lib/backlog'
import type { SourcePresentation } from '../lib/sources'
import { PriorityMenu } from '../status/priority-menu'
import { StatusMenu } from '../status/status-menu'
import { TicketLabel } from '../status/ticket-label'
import { ChildProgress } from './child-progress'
import { TreeRails, TreeStem, TreeTwig } from './tree-lines'

const markIcon = 'size-(--size-icon-meta) shrink-0'
type TreeAnchorStyle = CSSProperties & Record<'--ticket-tree-anchor', string>
const treeAnchor: TreeAnchorStyle = {
  '--ticket-tree-anchor': 'calc(var(--spacing-shell-icon) + var(--text-body--line-height) / 2)',
}
const sidebarTreeAnchor: TreeAnchorStyle = {
  '--ticket-tree-anchor': 'calc(var(--spacing-shell-item) + var(--text-body--line-height) / 2)',
}
// Past this many, the rest of a row's labels are counted rather than drawn.
const SHOWN_LABELS = 2

// The blocked mark and the children tally each carry their fact in text for a screen reader.
function Marks({ ticket }: { ticket: Ticket }) {
  const { t } = useTranslation('tickets')
  const blockers = openBlockers(ticket)
  const children = ticket.children.length
  if (blockers === 0 && children === 0) return null
  return (
    <span className="flex shrink-0 items-center gap-(--spacing-shell-item) type-meta text-muted-foreground">
      {blockers > 0 ? (
        <span className="flex items-center gap-(--spacing-shell-tight) text-danger">
          <Icon name="blocked" className={markIcon} />
          <span className="sr-only">{t('row.blockedBy', { count: blockers })}</span>
        </span>
      ) : null}
      {children > 0 ? (
        <span className="flex items-center gap-(--spacing-shell-tight) tabular-nums">
          <ChildProgress closed={closedChildren(ticket)} total={children} />
          <span aria-hidden="true">
            {closedChildren(ticket)}/{children}
          </span>
          <span className="sr-only">
            {t('row.childrenClosed', { closed: closedChildren(ticket), count: children })}
          </span>
        </span>
      ) : null}
    </span>
  )
}

function Labels({ labels }: { labels: Ticket['labels'] }) {
  const { t } = useTranslation('tickets')
  if (labels.length === 0) return null
  const hidden = labels.length - SHOWN_LABELS
  return (
    <span className="flex shrink-0 items-center gap-(--spacing-shell-tight)">
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
    <div className="mt-(--spacing-shell-tight) flex min-w-0 items-center gap-(--spacing-shell-item) pl-[calc(var(--size-icon-control)+var(--spacing-shell-tight))]">
      {props.provider === 'linear' ? (
        <span className="relative z-10 flex shrink-0 items-center">
          <PriorityMenu
            named={false}
            onChange={props.onChangePriority}
            priority={ticket.priority}
          />
        </span>
      ) : null}
      <span
        aria-hidden="true"
        className={`${props.presentation.keyColumn} shrink-0 font-mono type-meta text-faint`}
      >
        {ticket.key}
      </span>
      <span className="min-w-0 flex-1" />
      <Marks ticket={ticket} />
      <time className="shrink-0 type-meta text-faint tabular-nums" dateTime={ticket.createdAt}>
        <span aria-hidden="true">{age.short}</span>
        <span className="sr-only">{age.long}</span>
      </time>
    </div>
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
        <div className="flex min-w-0 items-start gap-(--spacing-shell-tight)">
          <span className="relative z-10 flex h-(--text-body--line-height) shrink-0 items-center">
            <StatusMenu
              named={false}
              noun={presentation.statusNoun}
              onChange={onChangeStatus}
              status={ticket.status}
              statuses={statuses}
            />
          </span>
          <button
            aria-current={selected ? 'true' : undefined}
            className="min-w-0 flex-1 text-left outline-none after:absolute after:inset-0 after:rounded-row focus-visible:after:outline-2 focus-visible:after:outline-ring focus-visible:after:-outline-offset-2"
            onClick={onSelect}
            type="button"
          >
            <span className="sr-only">{ticket.key} </span>
            <span className="line-clamp-2 type-body" title={ticket.title}>
              {ticket.title}
            </span>
            {parent === null ? null : (
              <span className="sr-only">{t('row.childOf', { parent })}</span>
            )}
          </button>
        </div>
        <SidebarMetadata {...props} />
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
        className={`${presentation.keyColumn} mt-(--spacing-shell-icon) shrink-0 font-mono type-body text-faint`}
      >
        {ticket.key}
      </span>
      <span className="mt-1 shrink-0">
        <StatusMenu
          named={false}
          noun={presentation.statusNoun}
          onChange={onChangeStatus}
          status={ticket.status}
          statuses={statuses}
        />
      </span>
      <span className="flex shrink-0 self-stretch" style={treeAnchor}>
        <TreeRails rails={rails} />
        <Fold folded={folded} onToggle={onToggle} row={row} />
      </span>
      <button
        aria-current={selected ? 'true' : undefined}
        className="@container flex min-w-0 flex-1 flex-wrap items-center gap-(--spacing-shell-item) py-(--spacing-shell-icon) text-left outline-none @[22rem]:flex-nowrap after:absolute after:inset-0 after:rounded-row focus-visible:after:outline-2 focus-visible:after:outline-ring focus-visible:after:-outline-offset-2"
        onClick={onSelect}
        type="button"
      >
        <span className="sr-only">{ticket.key} </span>
        <span
          className="order-1 min-w-0 flex-1 line-clamp-2 type-body @[22rem]:line-clamp-none @[22rem]:truncate"
          title={ticket.title}
        >
          {ticket.title}
        </span>
        <span className="order-2 mt-[calc((var(--text-body--line-height)-var(--size-icon-meta))_/_2)] self-start @[22rem]:order-3 @[22rem]:mt-0 @[22rem]:self-auto">
          <Marks ticket={ticket} />
        </span>
        <span className="order-3 flex min-w-0 basis-full @[22rem]:order-2 @[22rem]:basis-auto">
          <Labels labels={ticket.labels} />
        </span>
        <time
          className="order-4 hidden w-(--size-ticket-age) shrink-0 text-right type-meta text-faint tabular-nums @[var(--size-ticket-age-visible)]:block"
          dateTime={ticket.createdAt}
        >
          <span aria-hidden="true">{age.short}</span>
          <span className="sr-only">{age.long}</span>
        </time>
        {parent === null ? null : <span className="sr-only">{t('row.childOf', { parent })}</span>}
      </button>
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
