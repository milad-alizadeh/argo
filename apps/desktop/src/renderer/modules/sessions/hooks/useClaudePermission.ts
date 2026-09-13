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
      let reply: Awaited<ReturnType<typeof window.argo.readClaudePermission>>
      try {
        reply = await window.argo.readClaudePermission({
          version: 1,
          type: 'session.claude.permission',
          requestId: crypto.randomUUID(),
          sessionId,
        })
      } catch {
        if (live) setFailure('Argo could not read this Claude permission.')
        if (live) timer = window.setTimeout(read, 500)
        return
      }
      if (live) {
        if (reply.type === 'session.error') setFailure(reply.message)
        else {
          setFailure(null)
          setPermission(reply.permission)
        }
      }
      if (live) timer = window.setTimeout(read, 500)
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
