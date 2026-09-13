import { Check, ChevronDown, FolderGit2, Plus } from 'lucide-react'

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
import { useProjectsContext } from '../../projects/state/ProjectsContext'

export function ProjectSwitcher() {
  const [cockpit, actions] = useProjectsContext()
  const projectName = cockpit.project?.name ?? 'Select project'

  return (
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
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
