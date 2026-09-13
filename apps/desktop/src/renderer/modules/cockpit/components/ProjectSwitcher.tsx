import { Check, ChevronDown, FolderGit2, Plus, Settings } from 'lucide-react'
import { useState } from 'react'

import { REGISTER_PROJECT_COMMAND } from '@/core/commands/shortcuts'
import { Button } from '../../../components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu'
import { ProjectSettingsDialog } from '../../projects/components/ProjectSettingsDialog'
import { useProjects } from '../../projects/hooks/useProjects'
import { useCommands } from '../hooks/useCommands'

export function ProjectSwitcher() {
  const [cockpit, actions] = useProjects()
  useCommands((command) => {
    if (command === REGISTER_PROJECT_COMMAND) actions.open()
  })
  const projectName = cockpit.project?.name ?? 'Select project'
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={cockpit.busy}
          render={
            <Button
              aria-label={`Current project: ${projectName}`}
              variant="ghost"
              size="sm"
              className="gap-(--spacing-shell-tight) px-2 type-body"
            />
          }
        >
          <FolderGit2 />
          <span className="truncate font-medium">{projectName}</span>
          <ChevronDown className="text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Switch project</DropdownMenuLabel>
            {cockpit.projects.map((project) => (
              <DropdownMenuItem
                key={project.id}
                aria-label={`Switch to ${project.name}`}
                onClick={() => actions.select(project.id)}
              >
                <FolderGit2 />
                <span className="flex-1 truncate">{project.name}</span>
                {project.id === cockpit.project?.id ? <Check /> : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem aria-label="Add project" onClick={actions.open}>
            <Plus />
            Add project…
          </DropdownMenuItem>
          {cockpit.project ? (
            <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
              <Settings />
              Project settings…
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {cockpit.project ? (
        <ProjectSettingsDialog
          onOpenChange={setSettingsOpen}
          open={settingsOpen}
          project={cockpit.project}
        />
      ) : null}
    </>
  )
}
