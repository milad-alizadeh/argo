import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { REGISTER_PROJECT_COMMAND } from '@/platform/contract/commands'
import { Icon } from '@/platform/renderer/components/icon/icon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/platform/renderer/components/ui/dropdown-menu'
import { MenuDropdownTrigger } from '@/platform/renderer/components/ui/dropdown-trigger'
import { useCommands } from '@/platform/renderer/shell/hooks/use-commands'
import { useProjects } from '../hooks'
import { ProjectSettingsDialog } from './project-settings-dialog'

export function ProjectSwitcher() {
  const { t } = useTranslation('projects')
  const [projectState, actions] = useProjects()
  const navigate = useNavigate()
  useCommands((command) => {
    if (command === REGISTER_PROJECT_COMMAND) actions.open()
  })
  const projectName = projectState.project?.name ?? t('switcher.placeholder')
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <MenuDropdownTrigger
          aria-label={t('switcher.current', { name: projectName })}
          className="max-w-48 gap-(--spacing-shell-tight) border-0 pl-2 pr-(--spacing-shell-icon)"
          disabled={projectState.busy}
          icon="folder"
          label={projectName}
          variant="ghost"
        />
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{t('switcher.switchLabel')}</DropdownMenuLabel>
            {projectState.projects.map((project) => (
              <DropdownMenuItem
                key={project.id}
                aria-label={t('switcher.switchTo', { name: project.name })}
                onClick={() => navigate(`/projects/${project.id}/sessions`)}
              >
                <Icon name="folder" />
                <span className="flex-1 truncate">{project.name}</span>
                {project.id === projectState.project?.id ? <Icon name="confirmed" /> : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem aria-label={t('switcher.add')} onClick={actions.open}>
            <Icon name="add" />
            {t('switcher.addEllipsis')}
          </DropdownMenuItem>
          {projectState.project ? (
            <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
              <Icon name="settings" />
              {t('switcher.settings')}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {projectState.project ? (
        <ProjectSettingsDialog
          onOpenChange={setSettingsOpen}
          open={settingsOpen}
          project={projectState.project}
        />
      ) : null}
    </>
  )
}
