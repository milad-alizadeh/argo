import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToastManager } from '@/platform/renderer/components/ui/toast'
import type { Session, SessionId } from '../../types'
import type { SessionListActions } from '../rows/session-list-actions'

export function useRenameDialog(
  rename: (sessionId: SessionId, title: string) => void,
  clearRename: (sessionId: SessionId) => void,
  onRename: SessionListActions['onRename'],
) {
  const { t } = useTranslation('sessions')
  const { add } = useToastManager()
  const [renameTarget, setRenameTarget] = useState<Session | null>(null)
  const handleRename = useCallback(
    async (session: Session, name: string) => {
      rename(session.id, name)
      try {
        await onRename(session, name)
      } catch {
        clearRename(session.id)
        add({ title: t('rename.failure'), type: 'error' })
        return
      }
      clearRename(session.id)
    },
    [add, clearRename, rename, onRename, t],
  )
  return { renameTarget, setRenameTarget, handleRename }
}
