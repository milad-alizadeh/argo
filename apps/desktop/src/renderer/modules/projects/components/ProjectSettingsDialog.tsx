import { useTranslation } from 'react-i18next'
import type { ProjectSummary } from '@/core/projects/messages'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog'
import { SourceSettings } from '../../tickets/components/SourceSettings'
import { useConnection, useDisconnectSource } from '../../tickets/hooks/useTickets'

type ProjectSettingsDialogProps = {
  project: ProjectSummary
  open: boolean
  onOpenChange: (open: boolean) => void
}

// The Connection's form lives on the Tickets screen, so connecting goes there.
const TICKETS_PATH = '#/tickets'

export function ProjectSettingsDialog({ project, open, onOpenChange }: ProjectSettingsDialogProps) {
  const { t } = useTranslation('projects')
  const connection = useConnection(project.id)
  const disconnectSource = useDisconnectSource()
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('settings.title')}</DialogTitle>
          <DialogDescription className="grid">
            <span className="type-body font-medium text-foreground">{project.name}</span>
            <span className="truncate font-mono type-meta" title={project.path}>
              {project.path}
            </span>
          </DialogDescription>
        </DialogHeader>
        <SourceSettings
          connection={connection.isPending ? undefined : (connection.data ?? null)}
          disconnecting={disconnectSource.isPending}
          error={connection.error ?? disconnectSource.error}
          onConnect={() => {
            onOpenChange(false)
            window.location.hash = TICKETS_PATH
          }}
          onDisconnect={() => disconnectSource.mutate({ projectId: project.id })}
        />
      </DialogContent>
    </Dialog>
  )
}
