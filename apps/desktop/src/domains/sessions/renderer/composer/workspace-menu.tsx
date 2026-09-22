import { ChevronDown, FolderGit2, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { WorkspaceSummary } from '@/domains/projects/contract/workspace-messages'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/platform/renderer/components/ui/dropdown-menu'
import { InputGroupButton } from '@/platform/renderer/components/ui/input-group'

export type WorkspaceMenuControlProps = {
  workspaces: readonly WorkspaceSummary[]
  workspace: WorkspaceSummary | null
  onSelect: (workspaceId: string) => void
  onCreateManaged: () => void
}

// The composer's cwd choice: main, an existing Workspace, or a new managed one (#2600). Shown
// only while a Session has not started, since a Session's Workspace is fixed at `session.start`.
export function WorkspaceMenu({
  workspaces,
  workspace,
  onSelect,
  onCreateManaged,
}: WorkspaceMenuControlProps) {
  const { t } = useTranslation('sessions')
  const label = workspace?.displayName ?? t('composer.workspace.choose')
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <InputGroupButton
            variant="ghost"
            className="max-w-48 min-w-0 shrink-0 type-control text-foreground"
            aria-label={t('composer.workspace.chooseLabel', { workspace: label })}
          />
        }
      >
        <FolderGit2 />
        <span className="hidden min-w-0 truncate @[36rem]:inline">{label}</span>
        <ChevronDown className="hidden text-muted-foreground @[36rem]:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-(--size-session-menu) p-1.5">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 py-1.5 type-control text-muted-foreground">
            {t('composer.workspace.label')}
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup value={workspace?.id ?? ''} onValueChange={onSelect}>
            {workspaces.map((candidate) => (
              <DropdownMenuRadioItem
                key={candidate.id}
                value={candidate.id}
                closeOnClick
                className="items-start rounded-md py-1.5 pr-8 pl-2"
              >
                <span className="grid gap-0.5">
                  <span className="type-heading">{candidate.displayName}</span>
                  {candidate.facts.branch ? (
                    <span className="type-meta text-muted-foreground">
                      {candidate.facts.branch}
                    </span>
                  ) : null}
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onCreateManaged} className="rounded-md py-1.5 pr-8 pl-2">
          <Plus className="size-3.5" />
          {t('composer.workspace.createManaged')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
