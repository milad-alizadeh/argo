import { useCallback, useState } from 'react'
import type { Session, SessionId } from '../../types'
import type { SessionListActions } from '../rows/session-list-actions'

export function useRenameDialog(
  rename: (sessionId: SessionId, title: string) => void,
  onRename: SessionListActions['onRename'],
) {
  const [renameTarget, setRenameTarget] = useState<Session | null>(null)
  const handleRename = useCallback(
    async (session: Session, name: string) => rename(session.id, await onRename(session, name)),
    [rename, onRename],
  )
  return { renameTarget, setRenameTarget, handleRename }
}
