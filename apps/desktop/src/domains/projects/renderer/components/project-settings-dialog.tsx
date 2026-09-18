import { useTranslation } from 'react-i18next'
import type { ProjectSummary } from '@/domains/projects/contract/messages'
import { SourceSettings } from '@/domains/tickets/renderer/components/source-settings'
import { useConnection, useDisconnectSource } from '@/domains/tickets/renderer/hooks/use-tickets'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/renderer/components/ui/dialog'

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
