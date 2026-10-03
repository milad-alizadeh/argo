import { memo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { REGISTER_PROJECT_COMMAND } from '@/platform/contract/commands'
import { MenuDropdownTrigger } from '@/platform/renderer/components/dropdown-trigger'
import { Icon } from '@/platform/renderer/components/icon/icon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/platform/renderer/components/ui/dropdown-menu'
import { useCommands } from '@/platform/renderer/shell/hooks/use-commands'
import { type ProjectActions, type ProjectsState, useProjects } from '../hooks'
import { ProjectSettingsDialog } from './project-settings-dialog'

export function ProjectSwitcher() {
  const [projectState, actions] = useProjects()
  const navigate = useNavigate()
  return (
    <ProjectSwitcherControls projectState={projectState} actions={actions} navigate={navigate} />
  )
}

const ProjectSwitcherControls = memo(function ProjectSwitcherControls({
  projectState,
  actions,
  navigate,
}: {
  projectState: ProjectsState
  actions: ProjectActions
  navigate: ReturnType<typeof useNavigate>
}) {
  const { t } = useTranslation('projects')
  useCommands((command) => {
    if (command === REGISTER_PROJECT_COMMAND) actions.open()
  })
  const projectName = projectState.project?.name ?? t('switcher.placeholder')
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <MenuDropdownTrigger
          appearance="project"
          aria-label={t('switcher.current', { name: projectName })}
          className="max-w-48"
          disabled={projectState.busy}
          icon="folder"
          label={projectName}
        />
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{t('switcher.switchLabel')}</DropdownMenuLabel>
            {projectState.projects.map((project) => (
              <DropdownMenuItem
                key={project.id}
                aria-label={t('switcher.switchTo', { name: project.name })}
                aria-current={project.id === projectState.project?.id ? 'page' : undefined}
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
})
