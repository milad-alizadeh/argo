import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { WorkspaceSummary } from '@/domains/workspaces/renderer'
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

export type WorkspaceMenuControlProps = {
  workspaces: readonly WorkspaceSummary[]
  workspace: WorkspaceSummary | null
  choice: string | null
  saveFailed: boolean
  disabled?: boolean
  onSelect: (choice: string) => void
}

function workspaceValue(candidate: WorkspaceSummary) {
  return `${candidate.displayName} ${candidate.facts.branch ?? ''}`
}

function WorkspaceChoices({
  workspaces,
  choice,
  onSelect,
}: Pick<WorkspaceMenuControlProps, 'workspaces' | 'choice' | 'onSelect'>) {
  const { t } = useTranslation('sessions')
  const main = workspaces.find((candidate) => candidate.kind === 'main')
  const linked = workspaces.filter((candidate) => candidate.kind !== 'main')
  const selectedLinked = linked.find((candidate) => candidate.id === choice)
  let selectedValue: string | undefined
  if (choice === 'new') {
    selectedValue = t('composer.workspace.newWorktree')
  } else if (choice === main?.id) {
    selectedValue = main.facts.branch ?? main.displayName
  } else if (selectedLinked) {
    selectedValue = workspaceValue(selectedLinked)
  }
  return (
    <Command defaultValue={selectedValue} key={selectedValue ?? choice}>
      <CommandSearchField
        aria-label={t('composer.workspace.search')}
        placeholder={t('composer.workspace.search')}
      />
      <CommandList className="max-h-56">
        <CommandEmpty>
          <span aria-disabled="true" role="option" tabIndex={-1}>
            {t('composer.workspace.noMatches')}
          </span>
        </CommandEmpty>
        <CommandGroup>
          <SearchablePickerItem
            aria-current={choice === 'new' ? 'true' : undefined}
            data-checked={choice === 'new'}
            onSelect={() => onSelect('new')}
            value={t('composer.workspace.newWorktree')}
          >
            <Icon name="worktree" />
            <span>{t('composer.workspace.newWorktree')}</span>
          </SearchablePickerItem>
          {main ? (
            <SearchablePickerItem
              aria-current={choice === main.id ? 'true' : undefined}
              data-checked={choice === main.id}
              onSelect={() => onSelect(main.id)}
              value={main.facts.branch ?? main.displayName}
            >
              <Icon name="worktree" />
              <span className="min-w-0 truncate">{main.facts.branch ?? main.displayName}</span>
            </SearchablePickerItem>
          ) : null}
        </CommandGroup>
        {linked.length > 0 ? (
          <CommandGroup
            className="border-t border-border"
            heading={t('composer.workspace.existingWorktrees')}
          >
            {linked.map((candidate) => (
              <SearchablePickerItem
                aria-current={choice === candidate.id ? 'true' : undefined}
                data-checked={choice === candidate.id}
                key={candidate.id}
                onSelect={() => onSelect(candidate.id)}
                title={candidate.facts.branch ?? candidate.path}
                value={workspaceValue(candidate)}
              >
                <Icon name="worktree" />
                <span className="min-w-0 truncate">{candidate.displayName}</span>
              </SearchablePickerItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </Command>
  )
}

export function WorkspaceMenu({
  workspaces,
  workspace,
  choice,
  saveFailed,
  disabled = false,
  onSelect,
}: WorkspaceMenuControlProps) {
  const { t } = useTranslation('sessions')
  const [open, setOpen] = useState(false)
  let label = workspace?.displayName ?? t('composer.workspace.choose')
  if (choice === 'new') {
    label = t('composer.workspace.newWorktree')
  } else if (workspace?.kind === 'main') {
    label = workspace.facts.branch ?? workspace.displayName
  }
  const choose = (selected: string) => {
    onSelect(selected)
    setOpen(false)
  }
  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <SearchableDropdownTrigger
          appearance="menu"
          aria-label={t('composer.workspace.chooseLabel', { workspace: label })}
          className="max-w-full"
          disabled={disabled}
          icon="worktree"
          label={label}
          type="button"
        />
        <PopoverContent
          align="start"
          side="top"
          className="w-(--size-session-menu) max-w-(--size-session-menu-max-width) gap-0 p-0"
        >
          <PopoverTitle className="sr-only">{t('composer.workspace.label')}</PopoverTitle>
          <WorkspaceChoices workspaces={workspaces} choice={choice} onSelect={choose} />
        </PopoverContent>
      </Popover>
      {saveFailed ? (
        <span className="w-full type-meta text-destructive" role="status">
          {t('composer.workspace.saveFailed')}
        </span>
      ) : null}
    </div>
  )
}
