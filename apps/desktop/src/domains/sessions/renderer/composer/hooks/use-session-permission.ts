import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { Permission, PermissionDecision } from '@/domains/sessions/api/permissions'
import { trpcClient } from '@/platform/renderer/trpc-client'
import { sessionPermissionQueryKey } from '../../session-queries'

export type PermissionAnswer = PermissionDecision

export function useSessionPermission(sessionId: string | null) {
  // Held against the Session it happened in, since the Session screen stays mounted across a switch.
  const [failed, setFailed] = useState<{ sessionId: string; message: string } | null>(null)
  const failure = failed !== null && failed.sessionId === sessionId ? failed.message : null
  const queryClient = useQueryClient()
  const queryKey =
    sessionId === null ? ['sessions', 'permission', null] : sessionPermissionQueryKey(sessionId)
  const permission = useQuery<Permission | null, Error>({
    queryKey,
    enabled: sessionId !== null,
    retry: false,
    queryFn: async () => {
      if (sessionId === null) return null
      return trpcClient.sessionPermissionRead.query({ sessionId })
    },
  })
  const permissionDecision = usePermissionDecision()
  const decide = async (decision: PermissionAnswer) => {
    if (permission.data === null || permission.data === undefined) return false
    try {
      await permissionDecision.mutateAsync({ decision, permission: permission.data })
      queryClient.setQueryData(sessionPermissionQueryKey(permission.data.sessionId), null)
      setFailed(null)
      return true
    } catch (error) {
      setFailed({
        sessionId: permission.data.sessionId,
        message: error instanceof Error ? error.message : 'Argo could not decide this permission.',
      })
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
      await trpcClient.sessionPermissionDecide.mutate({
        sessionId: permission.sessionId,
        permissionId: permission.id,
        decision,
      })
    },
  })
}
