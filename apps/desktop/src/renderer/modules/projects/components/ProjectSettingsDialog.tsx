import type { ProjectSummary } from '@/core/projects/messages'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog'
import { RepositorySettings } from '../../tickets/components/RepositorySettings'
import { useBinding, useUnbind } from '../../tickets/hooks/useTickets'

type ProjectSettingsDialogProps = {
  project: ProjectSummary
  open: boolean
  onOpenChange: (open: boolean) => void
}

// The Binding's form lives on the Tickets screen, so connecting goes there.
const TICKETS_PATH = '#/tickets'

export function ProjectSettingsDialog({ project, open, onOpenChange }: ProjectSettingsDialogProps) {
  const binding = useBinding(project.id)
  const unbind = useUnbind()
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{project.name} settings</DialogTitle>
          <DialogDescription>Where this Project reads its Tickets from.</DialogDescription>
        </DialogHeader>
        <RepositorySettings
          binding={binding.isPending ? undefined : (binding.data ?? null)}
          disconnecting={unbind.isPending}
          error={binding.error ?? unbind.error}
          onConnect={() => {
            onOpenChange(false)
            window.location.hash = TICKETS_PATH
          }}
          onDisconnect={() => unbind.mutate({ projectId: project.id })}
        />
      </DialogContent>
    </Dialog>
  )
}
