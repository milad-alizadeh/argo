import type { Session } from '../../types'
import { SessionRenameDialog } from './session-rename-dialog'

export function RenameDialog({
  onRename,
  session,
  setSession,
}: {
  onRename: (session: Session, name: string) => Promise<void>
  session: Session | null
  setSession: (session: Session | null) => void
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
