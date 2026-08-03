import type { GitFacts, GitOperation } from '@shared'
import { useCallback, useEffect, useState } from 'react'

// The git group's facts are pulled, never pushed: nothing tells main that a branch moved outside
// the app, so a stream would promise a freshness it cannot keep. The renderer asks when the
// active project changes and again after it acts, which is exactly when the answer can differ.

export interface GitGroup {
  /** null while unread, and also when the folder is no git repository — either way the group
   * hides whole rather than rendering an empty branch. */
  facts: GitFacts | null
  run: (operation: GitOperation, ref?: string) => Promise<void>
}

export function useGitFacts(projectId: string | null): GitGroup {
  const [facts, setFacts] = useState<GitFacts | null>(null)

  const read = useCallback(async () => {
    if (projectId === null) return setFacts(null)
    setFacts(await (window.cockpit?.readGitFacts(projectId) ?? null))
  }, [projectId])

  useEffect(() => void read(), [read])

  const run = useCallback(
    async (operation: GitOperation, ref?: string) => {
      if (projectId === null) return
      await window.cockpit?.runGitOperation({ projectId, operation, ref })
      await read()
    },
    [projectId, read],
  )

  return { facts, run }
}
