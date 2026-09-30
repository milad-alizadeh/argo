import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToastManager } from '@/platform/renderer/components/ui/toast'
import type { Session } from '../../types'
import type { SessionListActions } from '../rows/session-list-actions'

export function useRenameDialog(onRename: SessionListActions['onRename']) {
  const { t } = useTranslation('sessions')
  const { add } = useToastManager()
  const [renameTarget, setRenameTarget] = useState<Session | null>(null)
  const handleRename = useCallback(
    async (session: Session, name: string) => {
      try {
        await onRename(session, name)
      } catch {
        add({ title: t('rename.failure'), type: 'error' })
      }
    },
    [add, onRename, t],
  )
  return { renameTarget, setRenameTarget, handleRename }
}
