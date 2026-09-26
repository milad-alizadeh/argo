import { useMutation, useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { attachmentKindOf } from '@/domains/sessions/api/attachments'
import { type RouterInputs, type RouterOutputs, trpc } from '@/platform/renderer/trpc-client'
import type { ComposerEditing } from '../editing/composer-editing'
import {
  supportedConfiguration,
  type TurnConfiguration,
  type TurnConfigurationChoices,
} from '../turn-configuration/turn-configuration'

export type DraftTarget = RouterInputs['composerDraftCreate']['target']
export type DraftContent = RouterInputs['composerDraftCreate']['content']
type DraftValue = RouterOutputs['composerDraftCreate']

type PersistedDraft = {
  id: string
  revision: number
  owner: string
  fingerprint: string
}

function ownerKey(target: DraftTarget | null) {
  if (target === null) return null
  return target.type === 'project' ? `project:${target.projectId}` : `session:${target.sessionId}`
}

function contentFromEditing(editing: ComposerEditing): DraftContent | null {
  if (editing.turnConfiguration === null) return null
  return {
    prompt: editing.prompt,
    attachments: editing.attachments.map(({ path }) => ({ path, kind: attachmentKindOf(path) })),
    ticketContext: editing.tickets,
    turnConfiguration: editing.turnConfiguration,
  }
}

function editingFromDraft(
  draft: DraftValue,
  choices: TurnConfigurationChoices,
  fallback: TurnConfiguration,
): ComposerEditing {
  return {
    prompt: draft.prompt,
    attachments: draft.attachments.map(({ path }, index) => ({
      id: `${draft.id}:${index}`,
      path,
      status: 'idle',
    })),
    tickets: draft.ticketContext,
    pendingTurns: [],
    turnConfiguration: supportedConfiguration(choices, draft.turnConfiguration, fallback),
  }
}

function fingerprint(content: DraftContent) {
  return JSON.stringify(content)
}

function useComposerDraftLoad(input: {
  target: DraftTarget | null
  choices: TurnConfigurationChoices | null
  opening: TurnConfiguration | null
  owner: string | null
  create: (input: RouterInputs['composerDraftCreate']) => Promise<DraftValue>
  persisted: React.RefObject<PersistedDraft | null>
  latestEditing: React.RefObject<ComposerEditing | null>
  saveTimer: React.RefObject<number | null>
}) {
  const { target, choices, opening, owner, create, persisted, latestEditing, saveTimer } = input
  const queryInput = target ?? { type: 'session' as const, sessionId: 'disabled' }
  const query = useQuery({
    ...trpc.composerDraftRead.queryOptions(queryInput),
    enabled: target !== null && choices !== null && opening !== null,
  })
  const [loaded, setLoaded] = useState<{ owner: string; editing: ComposerEditing } | null>(null)
  useEffect(() => {
    if (
      target === null ||
      choices === null ||
      opening === null ||
      owner === null ||
      query.isPending
    )
      return
    if (loaded?.owner === owner) return
    let active = true
    const empty = { prompt: '', attachments: [], ticketContext: [], turnConfiguration: opening }
    void (async () => {
      const draft = query.data ?? (await create({ target, content: empty }))
      if (!active) return
      const editing = editingFromDraft(draft, choices, opening)
      const content = contentFromEditing(editing)
      if (content === null) return
      persisted.current = {
        id: draft.id,
        revision: draft.revision,
        owner,
        fingerprint: fingerprint(content),
      }
      latestEditing.current = editing
      setLoaded({ owner, editing })
    })()
    return () => {
      active = false
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current)
    }
  }, [
    choices,
    create,
    latestEditing,
    loaded?.owner,
    opening,
    owner,
    persisted,
    query.data,
    query.isPending,
    saveTimer,
    target,
  ])
  return loaded?.owner === owner ? loaded.editing : null
}

function usePersistComposerDraft(input: {
  target: DraftTarget | null
  owner: string | null
  create: (input: RouterInputs['composerDraftCreate']) => Promise<DraftValue>
  save: (input: RouterInputs['composerDraftSave']) => Promise<DraftValue>
  persisted: React.RefObject<PersistedDraft | null>
  saveChain: React.RefObject<Promise<void>>
}) {
  const { target, owner, create, save, persisted, saveChain } = input
  return useCallback(
    (content: DraftContent) => {
      const operation = saveChain.current.then(async (): Promise<PersistedDraft> => {
        if (target === null || owner === null) throw new Error('Composer draft has no target.')
        const contentFingerprint = fingerprint(content)
        const current = persisted.current
        if (current?.owner === owner && current.fingerprint === contentFingerprint) return current
        const draft =
          current?.owner === owner
            ? await save({ id: current.id, expectedRevision: current.revision, target, content })
            : await create({ target, content })
        const next = {
          id: draft.id,
          revision: draft.revision,
          owner,
          fingerprint: contentFingerprint,
        }
        persisted.current = next
        return next
      })
      saveChain.current = operation.then(
        () => undefined,
        () => undefined,
      )
      return operation
    },
    [create, owner, persisted, save, saveChain, target],
  )
}

function useComposerDraftAutosave(input: {
  persist: (content: DraftContent) => Promise<PersistedDraft>
  persisted: React.RefObject<PersistedDraft | null>
  latestEditing: React.RefObject<ComposerEditing | null>
  saveTimer: React.RefObject<number | null>
}) {
  const { persist, persisted, latestEditing, saveTimer } = input
  return useCallback(
    (editing: ComposerEditing) => {
      latestEditing.current = editing
      const content = contentFromEditing(editing)
      if (content === null || fingerprint(content) === persisted.current?.fingerprint) return
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(() => void persist(content).catch(() => undefined), 250)
    },
    [latestEditing, persist, persisted, saveTimer],
  )
}

function useComposerDraftSubmit(input: {
  persist: (content: DraftContent) => Promise<PersistedDraft>
  persisted: React.RefObject<PersistedDraft | null>
  latestEditing: React.RefObject<ComposerEditing | null>
  saveTimer: React.RefObject<number | null>
  submit: (input: RouterInputs['sessionSubmit']) => Promise<{ sessionId: string }>
}) {
  const { persist, persisted, latestEditing, saveTimer, submit } = input
  return useCallback(
    async (
      prompt: string,
      turnConfiguration: TurnConfiguration | null,
      attachments: DraftContent['attachments'],
    ) => {
      const editing = latestEditing.current
      if (editing === null || turnConfiguration === null) return null
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current)
      try {
        const saved = await persist({
          prompt,
          attachments,
          ticketContext: editing.tickets,
          turnConfiguration,
        })
        const result = await submit({
          draftId: saved.id,
          expectedRevision: saved.revision,
          commandId: crypto.randomUUID(),
        })
        if (persisted.current?.id === saved.id) persisted.current = null
        return result.sessionId
      } catch {
        return null
      }
    },
    [latestEditing, persist, persisted, saveTimer, submit],
  )
}

export function useDurableComposerDraft(input: {
  target: DraftTarget | null
  choices: TurnConfigurationChoices | null
  opening: TurnConfiguration | null
}) {
  const { target, choices, opening } = input
  const { mutateAsync: createDraft } = useMutation(trpc.composerDraftCreate.mutationOptions())
  const { mutateAsync: saveDraft } = useMutation(trpc.composerDraftSave.mutationOptions())
  const { mutateAsync: submitDraft } = useMutation(trpc.sessionSubmit.mutationOptions())
  const persisted = useRef<PersistedDraft | null>(null)
  const latestEditing = useRef<ComposerEditing | null>(null)
  const saveChain = useRef<Promise<void>>(Promise.resolve())
  const saveTimer = useRef<number | null>(null)
  const owner = ownerKey(target)
  const create = useCallback(
    (value: RouterInputs['composerDraftCreate']) => createDraft(value),
    [createDraft],
  )
  const save = useCallback(
    (value: RouterInputs['composerDraftSave']) => saveDraft(value),
    [saveDraft],
  )
  const initialEditing = useComposerDraftLoad({
    target,
    choices,
    opening,
    owner,
    create,
    persisted,
    latestEditing,
    saveTimer,
  })
  const persist = usePersistComposerDraft({ target, owner, create, save, persisted, saveChain })
  const onEditingChange = useComposerDraftAutosave({ persist, persisted, latestEditing, saveTimer })
  const submitMutation = useCallback(
    (value: RouterInputs['sessionSubmit']) => submitDraft(value),
    [submitDraft],
  )
  const submit = useComposerDraftSubmit({
    persist,
    persisted,
    latestEditing,
    saveTimer,
    submit: submitMutation,
  })

  return initialEditing === null ? null : { initialEditing, onEditingChange, submit }
}
