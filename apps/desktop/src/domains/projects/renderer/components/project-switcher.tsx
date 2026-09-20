import { Check, ChevronDown, Folder, Plus, Settings } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { ProjectSettingsDialog } from '@/domains/projects/renderer/components/project-settings-dialog'
import { useProjects } from '@/domains/projects/renderer/hooks/use-projects'
import { useCommands } from '@/platform/renderer/cockpit/hooks/use-commands'
import { Button } from '@/platform/renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/platform/renderer/components/ui/dropdown-menu'
import { REGISTER_PROJECT_COMMAND } from '@/platform/shared/commands'

export function ProjectSwitcher() {
  const { t } = useTranslation('projects')
  const [cockpit, actions] = useProjects()
  const navigate = useNavigate()
  useCommands((command) => {
    if (command === REGISTER_PROJECT_COMMAND) navigate('/projects/new')
  })
  const projectName = cockpit.project?.name ?? t('switcher.placeholder')
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={cockpit.busy}
          render={
            <Button
              aria-label={t('switcher.current', { name: projectName })}
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
            <DropdownMenuLabel>{t('switcher.switchLabel')}</DropdownMenuLabel>
            {cockpit.projects.map((project) => (
              <DropdownMenuItem
                key={project.id}
                aria-label={t('switcher.switchTo', { name: project.name })}
                onClick={() => actions.select(project.id)}
              >
                <Folder />
                <span className="flex-1 truncate">{project.name}</span>
                {project.id === cockpit.project?.id ? <Check /> : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            aria-label={t('switcher.add')}
            onClick={() => navigate('/projects/new')}
          >
            <Plus />
            {t('switcher.addEllipsis')}
          </DropdownMenuItem>
          {cockpit.project ? (
            <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
              <Settings />
              {t('switcher.settings')}
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
