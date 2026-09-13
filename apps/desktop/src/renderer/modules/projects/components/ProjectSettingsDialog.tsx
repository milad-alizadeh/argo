import type { ProjectSummary } from '@/core/projects/messages'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog'
import { RepositorySettings } from '../../tickets/components/RepositorySettings'
import { useConnection, useDisconnectRepository } from '../../tickets/hooks/useTickets'

type ProjectSettingsDialogProps = {
  project: ProjectSummary
  open: boolean
  onOpenChange: (open: boolean) => void
}

// The Connection's form lives on the Tickets screen, so connecting goes there.
const TICKETS_PATH = '#/tickets'

export function ProjectSettingsDialog({ project, open, onOpenChange }: ProjectSettingsDialogProps) {
  const connection = useConnection(project.id)
  const disconnectRepository = useDisconnectRepository()
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Project settings</DialogTitle>
          <DialogDescription className="grid">
            <span className="type-body font-medium text-foreground">{project.name}</span>
            <span className="truncate font-mono type-meta" title={project.path}>
              {project.path}
            </span>
          </DialogDescription>
        </DialogHeader>
        <RepositorySettings
          connection={connection.isPending ? undefined : (connection.data ?? null)}
          disconnecting={disconnectRepository.isPending}
          error={connection.error ?? disconnectRepository.error}
          onConnect={() => {
            onOpenChange(false)
            window.location.hash = TICKETS_PATH
          }}
          onDisconnect={() => disconnectRepository.mutate({ projectId: project.id })}
        />
      </DialogContent>
    </Dialog>
  )
}
