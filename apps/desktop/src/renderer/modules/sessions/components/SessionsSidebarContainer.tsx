import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { currentSessionId } from '@/core/sessions/models'
import { useToastManager } from '@/renderer/components/ui/toast'
import { useProjects } from '../../projects/hooks/useProjects'
import { useSelectedProject } from '../../projects/hooks/useSelectedProject'
import { COMPOSER_FOCUS_STATE } from '../composer-focus-state'
import { useSessionArchiveMutation } from '../hooks/useSessionArchiveMutation'
import { useSessions } from '../hooks/useSessions'
import { useSessionTicketLink } from '../hooks/useSessionTicketLink'
import { useComposerStore } from '../state/useComposerStore'
import { newSessionTarget, useSessionCreationStore } from '../state/useSessionCreationStore'
import type { Session, SessionId } from '../types'
import { SessionsSidebarContent } from './SessionsSidebar'
import { SessionTicketLinkDialog } from './SessionTicketLinkDialog'

// A short-lived Undo (#2194 follow-up): its close is what makes an id "gone" from this
// component's perspective, and the manager fires that close for either reason interchangeably
// — a manual dismiss and the timeout both count as "the archive stands."
const UNDO_TOAST_TIMEOUT_MS = 8000

const SELECTED_SESSION_KEY = 'argo.selected-session-id'

// Restoring calls the same archive mutation with `archived: false` on the ids just applied, so
// this is what wires the bulk action to its own Undo, without either living inside the render body.
function useArchiveSelected() {
  const { t } = useTranslation('sessions')
  const { add } = useToastManager()
  const archiveMutation = useSessionArchiveMutation()
  return (sessionIds: SessionId[]) => {
    archiveMutation.mutate(
      { archived: true, sessionIds },
      {
        onSuccess: ({ applied, failed }) => {
          if (applied.length > 0) {
            add({
              title: t('bulkSelect.archived', { count: applied.length }),
              type: 'success',
              timeout: UNDO_TOAST_TIMEOUT_MS,
              actionProps: {
                children: t('bulkSelect.undo'),
                onClick: () => {
                  archiveMutation.mutate(
                    { archived: false, sessionIds: applied },
                    {
                      onSuccess: ({ applied: restored }) => {
                        if (restored.length > 0) {
                          add({
                            title: t('bulkSelect.restored', { count: restored.length }),
                            type: 'success',
                            timeout: UNDO_TOAST_TIMEOUT_MS,
                          })
                        }
                      },
                    },
                  )
                },
              },
            })
          }
          if (failed.length > 0) {
            add({
              title: applied.length > 0 ? t('bulkSelect.partialFailure') : t('bulkSelect.failure'),
              type: 'error',
              timeout: UNDO_TOAST_TIMEOUT_MS,
            })
          }
        },
      },
    )
  }
}

export function SessionsSidebar() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [cockpit] = useProjects()
  const lastHarness = useComposerStore(({ harness }) => harness)
  const pending = useSessionCreationStore(({ pending }) => pending)
  const { roster, rosterError } = useSessions(null, true, cockpit.project?.path ?? null)
  const project = useSelectedProject()
  const ticketLink = useSessionTicketLink()
  const [linkTarget, setLinkTarget] = useState<Session | null>(null)
  const archiveSelected = useArchiveSelected()
  useEffect(() => {
    if (sessionId !== undefined || roster === null || rosterError !== null) return
    const storedId = window.localStorage.getItem(SELECTED_SESSION_KEY)
    if (storedId === null) return
    // A stored id absent from the active Roster is not necessarily gone: the active list never
    // carries an archived Session, so this can still be one, restored by the Archive section
    // asking the reader for it by id (#1593). Navigate under the stored id either way; only a
    // Session the reader answers for nowhere at all fails to resolve, same as any stale id.
    const restoredId = currentSessionId(roster.sessions, storedId) ?? storedId
    navigate(`/sessions/${restoredId}`, { replace: true })
  }, [navigate, roster, rosterError, sessionId])

  return (
    <>
      <SessionsSidebarContent
        onArchiveSelected={archiveSelected}
        onLinkTicket={setLinkTarget}
        onNew={() => {
          const target = newSessionTarget(lastHarness, cockpit.project?.path ?? null)
          if (target === null) {
            navigate('/sessions/new')
            return
          }
          navigate(`/sessions/${target}`, { state: COMPOSER_FOCUS_STATE })
        }}
        onOpenTicket={(session) => {
          if (session.ticket !== null) navigate(`/tickets/${session.ticket.key}`)
        }}
        onRename={async (session, name) => {
          const reply = await window.argo.renameSession({ sessionId: session.id, name })
          if (reply.type === 'session.renamed') return reply.title
          throw new Error(reply.message)
        }}
        onSelect={(selectedSessionId: SessionId) => {
          // Picking a different row abandons an un-sent draft rather than leaving it a ghost row
          // nobody will ever send (#2109).
          if (pending?.stage === 'draft' && pending.id !== selectedSessionId) {
            useSessionCreationStore.getState().abandon(pending.id)
          }
          window.localStorage.setItem(SELECTED_SESSION_KEY, selectedSessionId)
          navigate(`/sessions/${selectedSessionId}`)
        }}
        onUnlinkTicket={(session) => void ticketLink.disconnect(session.id)}
        roster={roster}
        rosterError={rosterError}
        selectedSessionId={sessionId ?? null}
      />
      <SessionTicketLinkDialog
        onConnect={ticketLink.connect}
        onOpenChange={(open) => {
          if (!open) setLinkTarget(null)
        }}
        projectId={project?.id ?? null}
        session={linkTarget}
      />
    </>
  )
}
