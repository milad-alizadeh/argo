import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { REGISTER_PROJECT_COMMAND } from '@/platform/contract/commands'
import { useCommands } from '@/platform/renderer/cockpit/hooks/use-commands'
import { Icon } from '@/platform/renderer/components/icon/icon'
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
import { useProjects } from '../hooks'
import { ProjectSettingsDialog } from './project-settings-dialog'

export function ProjectSwitcher() {
  const { t } = useTranslation('projects')
  const [cockpit, actions] = useProjects()
  useCommands((command) => {
    if (command === REGISTER_PROJECT_COMMAND) actions.open()
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
          <Icon name="folder" />
          <span className="truncate font-medium">{projectName}</span>
          <Icon name="chevron-down" className="text-muted-foreground" />
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
                <Icon name="folder" />
                <span className="flex-1 truncate">{project.name}</span>
                {project.id === cockpit.project?.id ? <Icon name="confirmed" /> : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem aria-label={t('switcher.add')} onClick={actions.open}>
            <Icon name="add" />
            {t('switcher.addEllipsis')}
          </DropdownMenuItem>
          {cockpit.project ? (
            <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
              <Icon name="settings" />
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
