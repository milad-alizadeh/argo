import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CommandSearchField } from '@/platform/renderer/components/design-system/search-field'
import { SearchablePickerItem } from '@/platform/renderer/components/design-system/searchable-picker'
import { SearchableDropdownTrigger } from '@/platform/renderer/components/dropdown-trigger'
import { Icon } from '@/platform/renderer/components/icon/icon'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandList,
} from '@/platform/renderer/components/ui/command'
import { Popover, PopoverContent, PopoverTitle } from '@/platform/renderer/components/ui/popover'
import { Switch } from '@/platform/renderer/components/ui/switch'
import type { WorktreeOptionsActions, WorktreeOptionsState } from './use-worktree-options'

export type WorktreeRowProps = WorktreeOptionsState & WorktreeOptionsActions

type Options = NonNullable<WorktreeOptionsState['options']>

function FromChoices({
  options,
  from,
  onSelect,
}: {
  options: Options
  from: string | null
  onSelect: (from: string | null) => void
}) {
  const { t } = useTranslation('sessions')
  const current = options.checkout.branch
  // Picking the current branch is the same as the default, so it stays unremembered.
  const pickBranch = (branch: string) => onSelect(branch === current ? null : branch)
  return (
    <Command label={t('composer.worktree.search')}>
      <CommandSearchField
        aria-label={t('composer.worktree.search')}
        placeholder={t('composer.worktree.search')}
      />
      <CommandList className="max-h-72">
        <CommandEmpty>
          <span aria-disabled="true" role="option" tabIndex={-1}>
            {t('composer.worktree.noMatches')}
          </span>
        </CommandEmpty>
        <CommandGroup>
          {current === null ? (
            <SearchablePickerItem
              aria-current={from === null ? 'true' : undefined}
              data-checked={from === null}
              onSelect={() => onSelect(null)}
              value={t('composer.worktree.detached')}
            >
              <Icon name="worktree" />
              <span>{t('composer.worktree.detached')}</span>
            </SearchablePickerItem>
          ) : null}
          {options.branches.map((branch) => {
            const checked = (from ?? current) === branch
            return (
              <SearchablePickerItem
                aria-current={checked ? 'true' : undefined}
                data-checked={checked}
                key={branch}
                onSelect={() => pickBranch(branch)}
                title={branch}
                value={branch}
              >
                <Icon name="worktree" />
                <span className="min-w-0 truncate">{branch}</span>
              </SearchablePickerItem>
            )
          })}
        </CommandGroup>
      </CommandList>
    </Command>
  )
}

function FromMenu({
  options,
  from,
  currentLabel,
  chooseFrom,
}: Pick<WorktreeRowProps, 'from' | 'chooseFrom'> & { options: Options; currentLabel: string }) {
  const { t } = useTranslation('sessions')
  const [open, setOpen] = useState(false)
  const label = from ?? currentLabel
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <SearchableDropdownTrigger
        aria-label={t('composer.worktree.fromLabel', { start: label })}
        // Pulled out by its padding and border, so its icon lines up with the read-only branch.
        className="-ml-[calc(--spacing(2.5)+var(--size-border))] max-w-full min-w-0"
        icon="worktree"
        label={label}
        type="button"
      />
      <PopoverContent
        align="start"
        side="top"
        className="w-(--size-session-menu) max-w-(--size-session-menu-max-width) gap-0 p-0"
      >
        <PopoverTitle className="sr-only">{t('composer.worktree.start')}</PopoverTitle>
        <FromChoices
          options={options}
          from={from}
          onSelect={(selected) => {
            chooseFrom(selected)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

// With the switch on, the branch the new worktree starts from; off, the main checkout's branch.
function WorktreeBranch({
  options,
  newWorktree,
  from,
  chooseFrom,
}: Pick<WorktreeRowProps, 'newWorktree' | 'from' | 'chooseFrom'> & { options: Options }) {
  const { t } = useTranslation('sessions')
  const currentLabel = options.checkout.branch ?? t('composer.worktree.detached')
  if (newWorktree)
    return (
      <FromMenu options={options} from={from} currentLabel={currentLabel} chooseFrom={chooseFrom} />
    )
  return (
    <span
      className="flex min-w-0 items-center gap-1 text-muted-foreground"
      title={options.checkout.path}
    >
      <Icon name="worktree" size="control" />
      <span className="min-w-0 truncate type-control">{currentLabel}</span>
    </span>
  )
}

// Where a new Session works: the main checkout (off), or a new worktree from a local branch (on).
export function WorktreeRow({
  options,
  newWorktree,
  from,
  saveFailed,
  setNewWorktree,
  chooseFrom,
}: WorktreeRowProps) {
  const { t } = useTranslation('sessions')
  const switchId = useId()
  return (
    <section
      aria-label={t('composer.worktree.label')}
      className="grid gap-1 py-(--spacing-shell-item) pr-(--spacing-shell-item) pl-(--spacing-shell-inset)"
    >
      <div className="flex min-h-7 min-w-0 items-center gap-3">
        {options === null ? null : (
          <WorktreeBranch
            options={options}
            newWorktree={newWorktree}
            from={from}
            chooseFrom={chooseFrom}
          />
        )}
        <span className="flex shrink-0 items-center gap-2">
          <Switch
            checked={newWorktree}
            disabled={options === null}
            id={switchId}
            onCheckedChange={setNewWorktree}
            size="sm"
          />
          <label className="cursor-default type-control select-none" htmlFor={switchId}>
            {t('composer.worktree.switch')}
          </label>
        </span>
      </div>
      {saveFailed ? (
        <span className="type-meta text-destructive" role="status">
          {t('composer.worktree.saveFailed')}
        </span>
      ) : null}
    </section>
  )
}
