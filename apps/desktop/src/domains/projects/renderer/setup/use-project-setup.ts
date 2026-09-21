import { useCallback, useEffect, useState } from 'react'
import type {
  ProjectSetupCommand,
  ProjectSetupSnapshot,
} from '@/domains/projects/contract/contract'

export function useProjectSetup(projectId: string) {
  const [snapshot, setSnapshot] = useState<ProjectSetupSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    const unsubscribe = window.argo.subscribeProjectSetup(projectId, (reply) => {
      if (reply.type === 'project.setup.snapshot') setSnapshot(reply)
    })
    void window.argo.projectSetupSnapshot({ projectId }).then((reply) => {
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
      const reply = await window.argo.sendProjectSetupCommand({
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
