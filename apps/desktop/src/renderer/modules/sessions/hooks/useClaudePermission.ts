import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { ClaudePermission } from '@/core/sessions/contract'
import {
  type SessionContractError,
  throwSessionContractError,
  throwUnexpectedSessionReply,
} from '../session-contract-error'
import { invalidateSessionRoster, sessionPermissionQueryKey } from '../session-queries'

export function useClaudePermission(sessionId: string | null) {
  const [failure, setFailure] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const permission = useQuery<ClaudePermission | null, SessionContractError>({
    queryKey:
      sessionId === null ? ['sessions', 'permission', null] : sessionPermissionQueryKey(sessionId),
    enabled: sessionId !== null,
    refetchInterval: 500,
    retry: false,
    queryFn: async () => {
      if (sessionId === null) return null
      const reply = await window.argo.readClaudePermission({
        version: 1,
        type: 'session.claude.permission',
        requestId: crypto.randomUUID(),
        sessionId,
      })
      switch (reply.type) {
        case 'session.claude.permission.read':
          return reply.permission
        case 'session.error':
          return throwSessionContractError(reply)
        default:
          return throwUnexpectedSessionReply(reply)
      }
    },
  })
  const permissionDecision = usePermissionDecision()
  const decide = async (decision: 'allow' | 'deny') => {
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
      decision: 'allow' | 'deny'
      permission: ClaudePermission
    }) => {
      const reply = await window.argo.decideClaudePermission({
        version: 1,
        type: 'session.claude.permission.decide',
        requestId: crypto.randomUUID(),
        sessionId: permission.sessionId,
        permissionId: permission.id,
        decision,
      })
      switch (reply.type) {
        case 'session.claude.accepted':
          return
        case 'session.error':
          return throwSessionContractError(reply)
        default:
          return throwUnexpectedSessionReply(reply)
      }
    },
  })
}
