import { useCallback, useState } from 'react'
import type { RosterActions } from '@/domains/sessions/renderer/components/roster/roster-actions'
import type { Session, SessionId } from '@/domains/sessions/renderer/types'

export function useRenameDialog(
  rename: (sessionId: SessionId, title: string) => void,
  onRename: RosterActions['onRename'],
) {
  const [renameTarget, setRenameTarget] = useState<Session | null>(null)
  const handleRename = useCallback(
    async (session: Session, name: string) => rename(session.id, await onRename(session, name)),
    [rename, onRename],
  )
  return { renameTarget, setRenameTarget, handleRename }
}
