import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { WorkspaceSummary } from '@/domains/workspaces/renderer'
import { Icon, type IconName } from '@/platform/renderer/components/icon/icon'
import { Button } from '@/platform/renderer/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/platform/renderer/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from '@/platform/renderer/components/ui/popover'

export type WorkspaceMenuControlProps = {
  workspaces: readonly WorkspaceSummary[]
  workspace: WorkspaceSummary | null
  choice: string | null
  saveFailed: boolean
  onSelect: (choice: string) => void
}

function WorkspaceChoices({
  workspaces,
  choice,
  onSelect,
}: Pick<WorkspaceMenuControlProps, 'workspaces' | 'choice' | 'onSelect'>) {
  const { t } = useTranslation('sessions')
  const main = workspaces.find((candidate) => candidate.kind === 'main')
  const linked = workspaces.filter((candidate) => candidate.kind !== 'main')
  return (
    <Command>
      <CommandInput
        aria-label={t('composer.workspace.search')}
        placeholder={t('composer.workspace.search')}
      />
      <CommandList className="max-h-56">
        <CommandEmpty>{t('composer.workspace.noMatches')}</CommandEmpty>
        <CommandGroup>
          <CommandItem
            data-checked={choice === 'new'}
            onSelect={() => onSelect('new')}
            value={t('composer.workspace.newWorktree')}
          >
            <Icon name="add" />
            <span className="type-control">{t('composer.workspace.newWorktree')}</span>
          </CommandItem>
          {main ? (
            <CommandItem
              data-checked={choice === main.id}
              onSelect={() => onSelect(main.id)}
              value={t('composer.workspace.mainCheckout')}
            >
              <Icon name="repository" />
              <span className="type-control">{t('composer.workspace.mainCheckout')}</span>
              {main.facts.branch ? (
                <span className="ml-auto truncate type-meta text-muted-foreground">
                  {main.facts.branch}
                </span>
              ) : null}
            </CommandItem>
          ) : null}
        </CommandGroup>
        {linked.length > 0 ? (
          <CommandGroup
            className="border-t border-border"
            heading={t('composer.workspace.existingWorktrees')}
          >
            {linked.map((candidate) => (
              <CommandItem
                data-checked={choice === candidate.id}
                key={candidate.id}
                onSelect={() => onSelect(candidate.id)}
                title={candidate.facts.branch ?? candidate.path}
                value={`${candidate.displayName} ${candidate.facts.branch ?? ''}`}
              >
                <Icon name="worktree" />
                <span className="min-w-0 truncate type-control">{candidate.displayName}</span>
              </CommandItem>
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
  onSelect,
}: WorkspaceMenuControlProps) {
  const { t } = useTranslation('sessions')
  const [open, setOpen] = useState(false)
  let label = workspace?.displayName ?? t('composer.workspace.choose')
  let icon: IconName = 'worktree'
  if (choice === 'new') {
    label = t('composer.workspace.newWorktree')
    icon = 'add'
  } else if (workspace?.kind === 'main') {
    label = t('composer.workspace.mainCheckout')
    icon = 'repository'
  }
  const choose = (selected: string) => {
    onSelect(selected)
    setOpen(false)
  }
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              aria-label={t('composer.workspace.chooseLabel', { workspace: label })}
              className="max-w-full rounded-full type-control"
              size="sm"
              type="button"
              variant="outline"
            />
          }
        >
          <Icon name={icon} />
          <span className="max-w-64 truncate">{label}</span>
          <Icon className="text-muted-foreground" name="chevron-down" />
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="top"
          className="w-(--size-session-menu) max-w-(--size-session-menu-max-width) gap-0 p-1"
        >
          <PopoverTitle className="sr-only">{t('composer.workspace.label')}</PopoverTitle>
          <WorkspaceChoices workspaces={workspaces} choice={choice} onSelect={choose} />
        </PopoverContent>
      </Popover>
      {saveFailed ? (
        <span className="type-meta text-destructive" role="status">
          {t('composer.workspace.saveFailed')}
        </span>
      ) : null}
    </div>
  )
}
