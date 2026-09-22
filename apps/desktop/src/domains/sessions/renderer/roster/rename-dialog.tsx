import type { Session, SessionsListed } from '@/domains/sessions/renderer/types'
import { SessionRenameDialog } from './session-rename-dialog'

export function RenameDialog({
  onRename,
  session,
  setSession,
}: {
  onRename: (session: Session, name: string) => Promise<void>
  session: SessionsListed['sessions'][number] | null
  setSession: (session: SessionsListed['sessions'][number] | null) => void
}) {
  return (
    <SessionRenameDialog
      onOpenChange={(open) => {
        if (!open) setSession(null)
      }}
      onRename={onRename}
      session={session}
    />
  )
}
