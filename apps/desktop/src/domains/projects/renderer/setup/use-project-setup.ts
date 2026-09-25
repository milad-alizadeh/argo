import { useCallback, useEffect, useState } from 'react'
import type {
  ProjectSetupCommand,
  ProjectSetupSnapshot,
} from '@/domains/projects/contract/contract'
import { trpcClient } from '@/platform/renderer/trpc-client'

export function useProjectSetup(projectId: string) {
  const [snapshot, setSnapshot] = useState<ProjectSetupSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    const unsubscribe = window.argo.onProjectSetupChanged((reply) => {
      if (reply.projectId === projectId) setSnapshot(reply)
    })
    void trpcClient.projectSetupSnapshot.query({ projectId }).then((reply) => {
      if (active && reply.type === 'project.setup.snapshot') setSnapshot(reply)
      if (active) setLoading(false)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [projectId])
  const command = useCallback(
    async (command: ProjectSetupCommand) => {
      if (!snapshot) return
      const reply = await trpcClient.projectSetupCommand.mutate({
        projectId,
        command,
        commandId: crypto.randomUUID(),
        expectedRevision: snapshot.revision,
      })
      if (reply.type === 'project.setup.snapshot') setSnapshot(reply)
    },
    [projectId, snapshot],
  )
  return { command, loading, snapshot }
}
