import { Check, ChevronDown, Folder, Plus, Settings } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { REGISTER_PROJECT_COMMAND } from '@/core/commands/shortcuts'
import { ProjectSettingsDialog } from '@/domains/projects/renderer/components/project-settings-dialog'
import { useProjects } from '@/domains/projects/renderer/hooks/use-projects'
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
import { useCommands } from '../hooks/use-commands'

export function ProjectSwitcher() {
  const { t } = useTranslation('cockpit')
  const [cockpit, actions] = useProjects()
  useCommands((command) => {
    if (command === REGISTER_PROJECT_COMMAND) actions.open()
  })
  const projectName = cockpit.project?.name ?? t('projectSwitcher.placeholder')
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={cockpit.busy}
          render={
            <Button
              aria-label={t('projectSwitcher.current', { name: projectName })}
              variant="ghost"
              size="sm"
              className="gap-(--spacing-shell-tight) px-2 type-body"
            />
          }
        >
          <Folder />
          <span className="truncate font-medium">{projectName}</span>
          <ChevronDown className="text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{t('projectSwitcher.switchLabel')}</DropdownMenuLabel>
            {cockpit.projects.map((project) => (
              <DropdownMenuItem
                key={project.id}
                aria-label={t('projectSwitcher.switchTo', { name: project.name })}
                onClick={() => actions.select(project.id)}
              >
                <Folder />
                <span className="flex-1 truncate">{project.name}</span>
                {project.id === cockpit.project?.id ? <Check /> : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem aria-label={t('projectSwitcher.add')} onClick={actions.open}>
            <Plus />
            {t('projectSwitcher.addEllipsis')}
          </DropdownMenuItem>
          {cockpit.project ? (
            <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
              <Settings />
              {t('projectSwitcher.settings')}
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
