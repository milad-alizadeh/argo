import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import type { WorktreeSummary } from './use-worktree-choices'

export type WorktreeMenuControlProps = {
  worktrees: readonly WorktreeSummary[]
  choice: string | null
  saveFailed: boolean
  onSelect: (choice: string) => void
}

function linkedValue(candidate: WorktreeSummary) {
  return `${candidate.name} ${candidate.branch ?? ''}`
}

function mainLabel(main: WorktreeSummary) {
  return main.branch ?? main.name
}

function WorktreeChoices({
  worktrees,
  choice,
  onSelect,
}: Pick<WorktreeMenuControlProps, 'worktrees' | 'choice' | 'onSelect'>) {
  const { t } = useTranslation('sessions')
  const main = worktrees.find((candidate) => candidate.main)
  const linked = worktrees.filter((candidate) => !candidate.main)
  const selectedLinked = linked.find((candidate) => candidate.path === choice)
  let selectedValue: string | undefined
  if (choice === 'new') {
    selectedValue = t('composer.worktree.newWorktree')
  } else if (choice === 'main' && main) {
    selectedValue = mainLabel(main)
  } else if (selectedLinked) {
    selectedValue = linkedValue(selectedLinked)
  }
  return (
    <Command defaultValue={selectedValue} key={selectedValue ?? choice}>
      <CommandInput
        appearance="inline"
        aria-label={t('composer.worktree.search')}
        placeholder={t('composer.worktree.search')}
      />
      <CommandList className="max-h-56">
        <CommandEmpty>
          <span aria-disabled="true" role="option" tabIndex={-1}>
            {t('composer.worktree.noMatches')}
          </span>
        </CommandEmpty>
        <CommandGroup>
          <CommandItem
            aria-current={choice === 'new' ? 'true' : undefined}
            data-checked={choice === 'new'}
            onSelect={() => onSelect('new')}
            value={t('composer.worktree.newWorktree')}
          >
            <Icon name="worktree" />
            <span className="type-control">{t('composer.worktree.newWorktree')}</span>
          </CommandItem>
          {main ? (
            <CommandItem
              aria-current={choice === 'main' ? 'true' : undefined}
              data-checked={choice === 'main'}
              onSelect={() => onSelect('main')}
              value={mainLabel(main)}
            >
              <Icon name="worktree" />
              <span className="min-w-0 truncate type-control">{mainLabel(main)}</span>
            </CommandItem>
          ) : null}
        </CommandGroup>
        {linked.length > 0 ? (
          <CommandGroup
            className="border-t border-border"
            heading={t('composer.worktree.existingWorktrees')}
          >
            {linked.map((candidate) => (
              <CommandItem
                aria-current={choice === candidate.path ? 'true' : undefined}
                data-checked={choice === candidate.path}
                key={candidate.path}
                onSelect={() => onSelect(candidate.path)}
                title={candidate.branch ?? candidate.path}
                value={linkedValue(candidate)}
              >
                <Icon name="worktree" />
                <span className="min-w-0 truncate type-control">{candidate.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </Command>
  )
}

// The chosen existing folder's label, or null for a new worktree or a choice no longer offered.
function existingLabel(worktrees: readonly WorktreeSummary[], choice: string | null): string | null {
  const main = worktrees.find((candidate) => candidate.main)
  if (choice === 'main' && main) return mainLabel(main)
  return worktrees.find((candidate) => !candidate.main && candidate.path === choice)?.name ?? null
}

export function WorktreeMenu({ worktrees, choice, saveFailed, onSelect }: WorktreeMenuControlProps) {
  const { t } = useTranslation('sessions')
  const [open, setOpen] = useState(false)
  const label =
    choice === 'new'
      ? t('composer.worktree.newWorktree')
      : (existingLabel(worktrees, choice) ?? t('composer.worktree.choose'))
  const choose = (selected: string) => {
    onSelect(selected)
    setOpen(false)
  }
  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <SearchableDropdownTrigger
          aria-label={t('composer.worktree.chooseLabel', { worktree: label })}
          className="max-w-full rounded-full border-border bg-(--color-session-composer) backdrop-blur-(--blur-session-composer) type-control dark:border-border dark:bg-(--color-session-composer)"
          icon="worktree"
          label={label}
          type="button"
          variant="outline"
        />
        <PopoverContent
          align="start"
          side="top"
          className="w-(--size-session-menu) max-w-(--size-session-menu-max-width) gap-0 p-0"
        >
          <PopoverTitle className="sr-only">{t('composer.worktree.label')}</PopoverTitle>
          <WorktreeChoices worktrees={worktrees} choice={choice} onSelect={choose} />
        </PopoverContent>
      </Popover>
      {saveFailed ? (
        <span className="w-full type-meta text-destructive" role="status">
          {t('composer.worktree.saveFailed')}
        </span>
      ) : null}
    </div>
  )
}
