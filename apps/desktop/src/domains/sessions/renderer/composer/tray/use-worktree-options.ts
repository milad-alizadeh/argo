import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useRef, useState } from 'react'
import type { WorktreeStart } from '@/domains/sessions/api/worktree-request'
import { type RouterOutputs, trpc } from '@/platform/renderer/trpc-client'

type WorktreeOptionsOutput = RouterOutputs['worktreeOptions']
type WorktreeOptions = Extract<WorktreeOptionsOutput, { type: 'worktree.options' }>
export type PullRequestListing = RouterOutputs['worktreePullRequests']
export type WorktreeCheckout = WorktreeOptions['checkout']

// `options` is null while loading. `from` is null for the current checkout's branch.
export type WorktreeOptionsState = {
  options: { checkout: WorktreeCheckout; branches: readonly string[] } | null
  newWorktree: boolean
  from: WorktreeStart | null
  // Null while the pull requests load, or while the switch is off.
  pullRequests: PullRequestListing | null
  saveFailed: boolean
}

export type WorktreeOptionsActions = {
  setNewWorktree: (newWorktree: boolean) => void
  chooseFrom: (from: WorktreeStart | null) => void
}

const UNREACHABLE: PullRequestListing = { type: 'unavailable', reason: 'unreachable' }

type ForProject<T> = { projectId: string; value: T }

function forProject<T>(held: ForProject<T> | null, projectId: string | null): T | undefined {
  return held !== null && held.projectId === projectId ? held.value : undefined
}

function useRememberedSwitch(projectId: string | null, options: WorktreeOptions | undefined) {
  const queryClient = useQueryClient()
  const [local, setLocal] = useState<ForProject<boolean> | null>(null)
  const [saveFailure, setSaveFailure] = useState<string | null>(null)
  const { mutateAsync: save } = useMutation(trpc.worktreeSwitch.mutationOptions())
  const pending = useRef(Promise.resolve())
  const setNewWorktree = useCallback(
    (newWorktree: boolean) => {
      if (projectId === null) return
      const held = { projectId, value: newWorktree }
      setLocal(held)
      setSaveFailure(null)
      const settle = () => setLocal((current) => (current === held ? null : current))
      pending.current = pending.current.then(async () => {
        try {
          await save({ projectId, newWorktree })
          queryClient.setQueryData<WorktreeOptionsOutput>(
            trpc.worktreeOptions.queryKey({ projectId }),
            (current) =>
              current?.type === 'worktree.options' ? { ...current, newWorktree } : current,
          )
        } catch {
          setSaveFailure(projectId)
        }
        settle()
      })
    },
    [projectId, queryClient, save],
  )
  const newWorktree = forProject(local, projectId) ?? options?.newWorktree ?? false
  return {
    newWorktree,
    saveFailed: saveFailure !== null && saveFailure === projectId,
    setNewWorktree,
  }
}

export function useWorktreeOptions(
  projectId: string | null,
): [WorktreeOptionsState, WorktreeOptionsActions] {
  const query = useQuery({
    ...trpc.worktreeOptions.queryOptions({ projectId: projectId ?? '' }),
    enabled: projectId !== null,
    staleTime: 30_000,
    refetchInterval: 30_000,
  })
  const options = query.data?.type === 'worktree.options' ? query.data : undefined
  const remembered = useRememberedSwitch(projectId, options)
  // The start is never remembered: each Project, and each visit, begins on the current branch.
  const [from, setFrom] = useState<ForProject<WorktreeStart | null> | null>(null)
  const pullRequests = useQuery({
    ...trpc.worktreePullRequests.queryOptions({ projectId: projectId ?? '' }),
    enabled: projectId !== null && remembered.newWorktree,
    staleTime: 60_000,
    retry: false,
  })
  const listing = pullRequests.isError ? UNREACHABLE : (pullRequests.data ?? null)
  const chooseFrom = useCallback(
    (value: WorktreeStart | null) => {
      if (projectId !== null) setFrom({ projectId, value })
    },
    [projectId],
  )
  const state = useMemo(
    () => ({
      options:
        options === undefined ? null : { checkout: options.checkout, branches: options.branches },
      newWorktree: remembered.newWorktree,
      from: forProject(from, projectId) ?? null,
      pullRequests: remembered.newWorktree ? listing : null,
      saveFailed: remembered.saveFailed,
    }),
    [options, remembered.newWorktree, remembered.saveFailed, from, projectId, listing],
  )
  const actions = useMemo(
    () => ({ setNewWorktree: remembered.setNewWorktree, chooseFrom }),
    [remembered.setNewWorktree, chooseFrom],
  )
  return [state, actions]
}
