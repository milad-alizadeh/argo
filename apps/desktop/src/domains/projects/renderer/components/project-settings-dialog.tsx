import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { SourceSettings, useConnection, useDisconnectSource } from '@/domains/tickets/renderer'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/platform/renderer/components/ui/dialog'
import type { ProjectSummary } from '../hooks'

type ProjectSettingsDialogProps = {
  project: ProjectSummary
  open: boolean
  onOpenChange: (open: boolean) => void
}

function ProjectSettingsDescription({ name, path }: { name: string; path: string }) {
  return (
    <DialogDescription className="grid">
      <span className="type-body font-medium text-foreground">{name}</span>
      <span className="truncate font-mono type-meta" title={path}>
        {path}
      </span>
    </DialogDescription>
  )
}

// The Connection's form lives on the Tickets screen, so connecting goes there.
export function ProjectSettingsDialog({ project, open, onOpenChange }: ProjectSettingsDialogProps) {
  const { t } = useTranslation('projects')
  const { projectId = project.id } = useParams()
  const connection = useConnection(project.id)
  const disconnectSource = useDisconnectSource()
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-(--size-dialog-max-height) overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('settings.title')}</DialogTitle>
          <ProjectSettingsDescription name={project.name} path={project.path} />
        </DialogHeader>
        <SourceSettings
          connection={connection.isPending ? undefined : (connection.data ?? null)}
          disconnecting={disconnectSource.isPending}
          error={connection.error ?? disconnectSource.error}
          onConnect={() => {
            onOpenChange(false)
            window.location.hash = `#/projects/${projectId}/tickets`
          }}
          onDisconnect={() => disconnectSource.mutate({ projectId: project.id })}
        />
      </DialogContent>
    </Dialog>
  )
}
