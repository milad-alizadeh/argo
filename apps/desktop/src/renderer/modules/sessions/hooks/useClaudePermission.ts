import { useEffect, useState } from 'react'
import type { ClaudePermission } from '@/core/sessions/contract'
import { rereadSessions } from './useSessions'

export function useClaudePermission(sessionId: string | null) {
  const [permission, setPermission] = useState<ClaudePermission | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  useEffect(() => {
    setPermission(null)
    setFailure(null)
    if (sessionId === null) return
    let live = true
    let timer: number | null = null
    const read = async () => {
      const reply = await readPermission(sessionId)
      if (!live) return
      applyPermissionReply(reply, setFailure, setPermission)
      timer = window.setTimeout(read, 500)
    }
    void read()
    return () => {
      live = false
      if (timer !== null) window.clearTimeout(timer)
    }
  }, [sessionId])
  const decide = async (decision: 'allow' | 'deny') => {
    if (permission === null) return false
    const reply = await window.argo.decideClaudePermission({
      version: 1,
      type: 'session.claude.permission.decide',
      requestId: crypto.randomUUID(),
      sessionId: permission.sessionId,
      permissionId: permission.id,
      decision,
    })
    if (reply.type === 'session.error') {
      setFailure(reply.message)
      return false
    }
    setPermission(null)
    rereadSessions()
    return true
  }
  return { decide, failure, permission }
}

async function readPermission(sessionId: string) {
  try {
    return await window.argo.readClaudePermission({
      version: 1,
      type: 'session.claude.permission',
      requestId: crypto.randomUUID(),
      sessionId,
    })
  } catch {
    return null
  }
}

function applyPermissionReply(
  reply: Awaited<ReturnType<typeof window.argo.readClaudePermission>> | null,
  setFailure: (value: string | null) => void,
  setPermission: (value: ClaudePermission | null) => void,
) {
  if (reply === null) {
    setFailure('Argo could not read this Claude permission.')
    return
  }
  if (reply.type === 'session.error') {
    setFailure(reply.message)
    return
  }
  setFailure(null)
  setPermission(reply.permission)
}
