import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { WorktreeStart } from '@/domains/sessions/api/worktree-request'
import { Icon } from '@/platform/renderer/components/icon/icon'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/platform/renderer/components/ui/command'
import { SearchableDropdownTrigger } from '@/platform/renderer/components/ui/dropdown-trigger'
import { Popover, PopoverContent, PopoverTitle } from '@/platform/renderer/components/ui/popover'
import { Switch } from '@/platform/renderer/components/ui/switch'
import type { PullRequestListing, WorktreeOptionsState } from './use-worktree-options'

export type WorktreeRowProps = WorktreeOptionsState & {
  onNewWorktreeChange: (newWorktree: boolean) => void
  onFromChange: (from: WorktreeStart | null) => void
}

type Options = NonNullable<WorktreeOptionsState['options']>
type PullRequest = Extract<PullRequestListing, { type: 'listed' }>['pullRequests'][number]

function pullRequestLabel(pullRequest: Pick<PullRequest, 'number' | 'title'>) {
  return `#${pullRequest.number} ${pullRequest.title}`
}

function sameStart(left: WorktreeStart | null, right: WorktreeStart | null): boolean {
  if (left === null || right === null) return left === right
  if (left.type === 'branch') return right.type === 'branch' && right.branch === left.branch
  return right.type === 'pull-request' && right.number === left.number
}

// Why no pull requests are listed, drawn below the list; null when they are.
function PullRequestNote({ listing }: { listing: PullRequestListing | null }) {
  const { t } = useTranslation('sessions')
  let note: string | null = null
  if (listing === null) note = t('composer.worktree.pullRequestsLoading')
  else if (listing.type === 'unavailable')
    note = t(`composer.worktree.pullRequestsUnavailable.${listing.reason}`)
  else if (listing.pullRequests.length === 0) note = t('composer.worktree.noPullRequests')
  if (note === null) return null
  return (
    <p className="border-t border-border px-3 py-2 type-meta text-muted-foreground" role="status">
      {note}
    </p>
  )
}

function PullRequestItems({
  listing,
  from,
  onSelect,
}: {
  listing: PullRequestListing | null
  from: WorktreeStart | null
  onSelect: (from: WorktreeStart) => void
}) {
  const { t } = useTranslation('sessions')
  if (listing?.type !== 'listed' || listing.pullRequests.length === 0) return null
  return (
    <CommandGroup className="border-t border-border" heading={t('composer.worktree.pullRequests')}>
      {listing.pullRequests.map((pullRequest) => {
        const start = { type: 'pull-request' as const, number: pullRequest.number }
        const checked = sameStart(from, start)
        return (
          <CommandItem
            aria-current={checked ? 'true' : undefined}
            data-checked={checked}
            key={pullRequest.number}
            onSelect={() => onSelect(start)}
            title={pullRequest.branch}
            value={`${pullRequestLabel(pullRequest)} ${pullRequest.branch}`}
          >
            <Icon name="pull-request-open" />
            <span className="min-w-0 truncate type-control">{pullRequestLabel(pullRequest)}</span>
          </CommandItem>
        )
      })}
    </CommandGroup>
  )
}

function FromChoices({
  options,
  from,
  pullRequests,
  onSelect,
}: {
  options: Options
  from: WorktreeStart | null
  pullRequests: PullRequestListing | null
  onSelect: (from: WorktreeStart | null) => void
}) {
  const { t } = useTranslation('sessions')
  const current = options.checkout.branch
  // Picking the current branch is the same as the default, so it stays unremembered.
  const pickBranch = (branch: string) =>
    onSelect(branch === current ? null : { type: 'branch', branch })
  return (
    <Command>
      <CommandInput
        appearance="inline"
        aria-label={t('composer.worktree.search')}
        placeholder={t('composer.worktree.search')}
      />
      <CommandList className="max-h-72">
        <CommandEmpty>
          <span aria-disabled="true" role="option" tabIndex={-1}>
            {t('composer.worktree.noMatches')}
          </span>
        </CommandEmpty>
        <CommandGroup heading={t('composer.worktree.branches')}>
          {current === null ? (
            <CommandItem
              aria-current={from === null ? 'true' : undefined}
              data-checked={from === null}
              onSelect={() => onSelect(null)}
              value={t('composer.worktree.detached')}
            >
              <Icon name="worktree" />
              <span className="type-control">{t('composer.worktree.detached')}</span>
            </CommandItem>
          ) : null}
          {options.branches.map((branch) => {
            const checked =
              from === null ? branch === current : sameStart(from, { type: 'branch', branch })
            return (
              <CommandItem
                aria-current={checked ? 'true' : undefined}
                data-checked={checked}
                key={branch}
                onSelect={() => pickBranch(branch)}
                title={branch}
                value={branch}
              >
                <Icon name="worktree" />
                <span className="min-w-0 truncate type-control">{branch}</span>
              </CommandItem>
            )
          })}
        </CommandGroup>
        <PullRequestItems listing={pullRequests} from={from} onSelect={onSelect} />
      </CommandList>
      <PullRequestNote listing={pullRequests} />
    </Command>
  )
}

function fromLabel(
  {
    options,
    from,
    pullRequests,
  }: Pick<WorktreeRowProps, 'from' | 'pullRequests'> & {
    options: Options
  },
  detached: string,
): string {
  if (from === null) return options.checkout.branch ?? detached
  if (from.type === 'branch') return from.branch
  const listed =
    pullRequests?.type === 'listed'
      ? pullRequests.pullRequests.find((pullRequest) => pullRequest.number === from.number)
      : undefined
  return listed === undefined ? `#${from.number}` : pullRequestLabel(listed)
}

function FromMenu({
  options,
  from,
  pullRequests,
  onFromChange,
}: Pick<WorktreeRowProps, 'from' | 'pullRequests' | 'onFromChange'> & { options: Options }) {
  const { t } = useTranslation('sessions')
  const [open, setOpen] = useState(false)
  const label = fromLabel({ options, from, pullRequests }, t('composer.worktree.detached'))
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <SearchableDropdownTrigger
        aria-label={t('composer.worktree.fromLabel', { start: label })}
        className="max-w-full min-w-0 type-control"
        icon="worktree"
        label={label}
        type="button"
        variant="ghost"
      />
      <PopoverContent
        align="start"
        side="top"
        className="w-(--size-session-menu) max-w-(--size-session-menu-max-width) gap-0 p-0"
      >
        <PopoverTitle className="sr-only">{t('composer.worktree.from')}</PopoverTitle>
        <FromChoices
          options={options}
          from={from}
          pullRequests={pullRequests}
          onSelect={(selected) => {
            onFromChange(selected)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

// With the switch on, where the new worktree starts; with it off, the main checkout's branch.
function WorktreePlace({
  options,
  newWorktree,
  from,
  pullRequests,
  onFromChange,
}: Pick<WorktreeRowProps, 'newWorktree' | 'from' | 'pullRequests' | 'onFromChange'> & {
  options: Options
}) {
  const { t } = useTranslation('sessions')
  if (newWorktree)
    return (
      <span className="flex min-w-0 items-center gap-1">
        <span className="shrink-0 type-control text-muted-foreground">
          {t('composer.worktree.from')}
        </span>
        <FromMenu
          options={options}
          from={from}
          pullRequests={pullRequests}
          onFromChange={onFromChange}
        />
      </span>
    )
  return (
    <span
      className="flex min-w-0 items-center gap-1 text-muted-foreground"
      title={options.checkout.path}
    >
      <Icon name="worktree" size="control" />
      <span className="min-w-0 truncate type-control">
        {options.checkout.branch ?? t('composer.worktree.detached')}
      </span>
    </span>
  )
}

// Where a new Session works: the main checkout (off), or a new worktree from a branch or pull request (on).
export function WorktreeRow({
  options,
  newWorktree,
  from,
  pullRequests,
  saveFailed,
  onNewWorktreeChange,
  onFromChange,
}: WorktreeRowProps) {
  const { t } = useTranslation('sessions')
  const labelId = useId()
  return (
    <section
      aria-label={t('composer.worktree.label')}
      className="grid gap-1 py-(--spacing-shell-item) pr-(--spacing-shell-item) pl-(--spacing-shell-inset)"
    >
      <div className="flex min-h-7 min-w-0 items-center gap-3">
        <span className="flex shrink-0 items-center gap-2">
          <Switch
            aria-labelledby={labelId}
            checked={newWorktree}
            disabled={options === null}
            onCheckedChange={onNewWorktreeChange}
            size="sm"
          />
          <span className="type-control" id={labelId}>
            {t('composer.worktree.switch')}
          </span>
        </span>
        {options === null ? null : (
          <WorktreePlace
            options={options}
            newWorktree={newWorktree}
            from={from}
            pullRequests={pullRequests}
            onFromChange={onFromChange}
          />
        )}
      </div>
      {saveFailed ? (
        <span className="type-meta text-destructive" role="status">
          {t('composer.worktree.saveFailed')}
        </span>
      ) : null}
    </section>
  )
}
