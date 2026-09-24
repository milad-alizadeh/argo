import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { Permission, SessionPermissionDecisionRequest } from '@/domains/sessions/contract/ipc'
import {
  type SessionContractError,
  throwSessionContractError,
  throwUnexpectedSessionReply,
} from '../../session-contract-error'
import { invalidateSessionList, sessionPermissionQueryKey } from '../../session-queries'
import { useWatchedQueries } from '../../use-watched-topic'

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
  useWatchedQueries('permissions', [queryKey])
  const permissionDecision = usePermissionDecision()
  const decide = async (decision: PermissionAnswer) => {
    if (permission.data === null || permission.data === undefined) return false
    try {
      await permissionDecision.mutateAsync({ decision, permission: permission.data })
      queryClient.setQueryData(sessionPermissionQueryKey(permission.data.sessionId), null)
      await invalidateSessionList(queryClient)
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
