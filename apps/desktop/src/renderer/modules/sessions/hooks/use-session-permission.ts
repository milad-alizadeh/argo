import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { Permission, SessionPermissionDecisionRequest } from '@/core/sessions/contract'
import { useWatchedQueries } from '@/renderer/core/hooks/use-watched-topic'
import {
  type SessionContractError,
  throwSessionContractError,
  throwUnexpectedSessionReply,
} from '../session-contract-error'
import { invalidateSessionRoster, sessionPermissionQueryKey } from '../session-queries'

export type PermissionAnswer = SessionPermissionDecisionRequest['decision']

export function useSessionPermission(sessionId: string | null) {
  const [failure, setFailure] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const queryKey =
    sessionId === null ? ['sessions', 'permission', null] : sessionPermissionQueryKey(sessionId)
  const permission = useQuery<Permission | null, SessionContractError>({
    queryKey,
    enabled: sessionId !== null,
    retry: false,
    queryFn: async () => {
      if (sessionId === null) return null
      const reply = await window.argo.readSessionPermission({ sessionId })
      switch (reply.type) {
        case 'session.permission.read':
          return reply.permission
        case 'session.error':
          return throwSessionContractError(reply)
        default:
          return throwUnexpectedSessionReply(reply)
      }
    },
  })
  // The main process is where a Permission appears and where a decision clears it, so it says when
  // to read again (#2299). The topic carries no Session id: a window shows one Session, so another
  // Session's Permission costs this screen one read. Unlike the transcript reads, no fallback poll
  // stands behind it, because the push comes from the process holding the Permission, not from a
  // file watch the OS can drop.
  useWatchedQueries('permissions', [queryKey])
  const permissionDecision = usePermissionDecision()
  const decide = async (decision: PermissionAnswer) => {
    if (permission.data === null || permission.data === undefined) return false
    try {
      await permissionDecision.mutateAsync({ decision, permission: permission.data })
      queryClient.setQueryData(sessionPermissionQueryKey(permission.data.sessionId), null)
      await invalidateSessionRoster(queryClient)
      setFailure(null)
      return true
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'Argo could not decide this permission.')
      return false
    }
  }
  return {
    decide,
    failure: failure ?? permission.error?.message ?? null,
    permission: permission.data ?? null,
  }
}

function usePermissionDecision() {
  return useMutation({
    mutationFn: async ({
      decision,
      permission,
    }: {
      decision: PermissionAnswer
      permission: Permission
    }) => {
      const reply = await window.argo.decideSessionPermission({
        sessionId: permission.sessionId,
        permissionId: permission.id,
        decision,
      })
      switch (reply.type) {
        case 'session.accepted':
          return
        case 'session.error':
          return throwSessionContractError(reply)
        default:
          return throwUnexpectedSessionReply(reply)
      }
    },
  })
}
