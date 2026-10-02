import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isTRPCClientError } from '@trpc/client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppRouter } from '@/platform/main/trpc-router'
import { type RouterInputs, type RouterOutputs, trpc } from '@/platform/renderer/trpc-client'
import type { ComposerEditing } from '../editing/composer-editing'
import type {
  TurnConfiguration,
  TurnConfigurationChoices,
} from '../turn-configuration/turn-configuration'
import {
  adoptComposerDraft,
  type ComposerDraftRecord,
  contentFromEditing,
  type DraftContent,
  type DraftTarget,
  type DraftValue,
  fingerprint,
  type LoadedDraft,
  loadedDraft,
  type PersistedDraft,
  useCachedComposerDraft,
} from './composer-draft-adoption'
import { forgetComposerDraft, rememberComposerDraft } from './composer-draft-cache'
import { shouldLoadComposerDraft } from './composer-draft-load'
import {
  type ComposerDraftActionInput,
  cancelPendingSave,
  type PendingSave,
  useComposerDraftSubmit,
} from './composer-draft-submit'

export type { DraftContent, DraftTarget }

type DraftLoadDependencies = ComposerDraftRecord & {
  create: (input: RouterInputs['composerDraftCreate']) => Promise<DraftValue>
}
type ComposerDraftLoadInput = Omit<DraftLoadDependencies, 'setLoaded' | 'remember'> & {
  target: DraftTarget | null
  choices: TurnConfigurationChoices | null
  opening: TurnConfiguration | null
  owner: string | null
  targetRestored: boolean
}
type DurableComposerDraftInput = {
  target: DraftTarget | null
  choices: TurnConfigurationChoices | null
  opening: TurnConfiguration | null
  targetRestored: boolean
}

function ownerKey(target: DraftTarget | null) {
  if (target === null) return null
  return target.type === 'project' ? `project:${target.projectId}` : `session:${target.sessionId}`
}

function startComposerDraftLoad(
  input: DraftLoadDependencies & {
    target: DraftTarget
    choices: TurnConfigurationChoices
    opening: TurnConfiguration
    owner: string
    draft: DraftValue | undefined
  },
) {
  let active = true
  const empty = { prompt: '', attachments: [], ticketContext: [], turnConfiguration: input.opening }
  void (async () => {
    const draft = input.draft ?? (await input.create({ target: input.target, content: empty }))
    if (!active) return
    const { owner, choices, opening } = input
    adoptComposerDraft(input, loadedDraft({ owner, draft, choices, opening }), draft)
  })()
  return () => {
    active = false
  }
}

function draftLoadIdentities({
  target,
  choices,
  opening,
}: {
  target: DraftTarget | null
  choices: TurnConfigurationChoices | null
  opening: TurnConfiguration | null
}) {
  return {
    targetIdentity: target === null ? null : JSON.stringify(target),
    choicesIdentity: JSON.stringify(choices),
    openingIdentity: JSON.stringify(opening),
  }
}

function suppressAcceptedEmptyDraft(
  owner: string,
  content: DraftContent,
  suppressedOwner: React.RefObject<string | null>,
) {
  if (suppressedOwner.current !== owner) return false
  suppressedOwner.current = null
  return content.prompt.length === 0 && content.attachments.length === 0
}

function startDraftLoadIfReady(
  input: DraftLoadDependencies & {
    target: DraftTarget | null
    choices: TurnConfigurationChoices | null
    opening: TurnConfiguration | null
    owner: string | null
    loadedOwner: string | null
    isPending: boolean
    isFetching: boolean
    isError: boolean
    hasData: boolean
    draft: DraftValue | undefined
  },
) {
  const { target, choices, opening, owner } = input
  if (
    target === null ||
    choices === null ||
    opening === null ||
    owner === null ||
    input.isPending ||
    !shouldLoadComposerDraft({
      owner,
      loadedOwner: input.loadedOwner,
      isFetching: input.isFetching,
      isError: input.isError,
      hasData: input.hasData,
    })
  )
    return
  return startComposerDraftLoad({
    target,
    choices,
    opening,
    owner,
    draft: input.draft,
    create: input.create,
    persisted: input.persisted,
    latestEditing: input.latestEditing,
    setLoaded: input.setLoaded,
    initialFingerprints: input.initialFingerprints,
    remember: input.remember,
  })
}

function startComposerDraftLoadEffect(
  input: DraftLoadDependencies & {
    target: DraftTarget | null
    choices: TurnConfigurationChoices | null
    opening: TurnConfiguration | null
    owner: string | null
    targetIdentity: string | null
    choicesIdentity: string
    openingIdentity: string
    latestTarget: DraftTarget | null
    latestChoices: TurnConfigurationChoices | null
    latestOpening: TurnConfiguration | null
    loadedOwner: string | null
    isPending: boolean
    isFetching: boolean
    isError: boolean
    hasData: boolean
    draft: DraftValue | undefined
  },
) {
  if (
    input.targetIdentity !==
      (input.latestTarget === null ? null : JSON.stringify(input.latestTarget)) ||
    input.choicesIdentity !== JSON.stringify(input.latestChoices) ||
    input.openingIdentity !== JSON.stringify(input.latestOpening)
  )
    return
  return startDraftLoadIfReady(input)
}

type DraftReadState = {
  isPending: boolean
  isFetching: boolean
  isError: boolean
  data: DraftValue | null | undefined
}

type DraftLoadStart = ComposerDraftLoadInput &
  Pick<DraftLoadDependencies, 'setLoaded' | 'remember'> & {
    loadedOwner: string | null
    query: DraftReadState
  }

function useStartComposerDraftLoad(input: DraftLoadStart) {
  const targetRef = useRef(input.target)
  const configurationRef = useRef({ choices: input.choices, opening: input.opening })
  targetRef.current = input.target
  configurationRef.current = { choices: input.choices, opening: input.opening }
  const { targetIdentity, choicesIdentity, openingIdentity } = draftLoadIdentities(input)
  useEffect(() => {
    if (!input.targetRestored) return
    return startComposerDraftLoadEffect({
      create: input.create,
      persisted: input.persisted,
      latestEditing: input.latestEditing,
      initialFingerprints: input.initialFingerprints,
      remember: input.remember,
      target: targetRef.current,
      choices: configurationRef.current.choices,
      opening: configurationRef.current.opening,
      owner: input.owner,
      targetIdentity,
      choicesIdentity,
      openingIdentity,
      latestTarget: targetRef.current,
      latestChoices: configurationRef.current.choices,
      latestOpening: configurationRef.current.opening,
      loadedOwner: input.loadedOwner,
      isPending: input.query.isPending,
      isFetching: input.query.isFetching,
      isError: input.query.isError,
      hasData: input.query.data !== undefined,
      draft: input.query.data ?? undefined,
      setLoaded: input.setLoaded,
    })
  }, [
    input.owner,
    input.targetRestored,
    targetIdentity,
    choicesIdentity,
    openingIdentity,
    input.loadedOwner,
    input.query.data,
    input.query.isFetching,
    input.query.isError,
    input.query.isPending,
    input.create,
    input.persisted,
    input.latestEditing,
    input.initialFingerprints,
    input.remember,
    input.setLoaded,
  ])
}

function useComposerDraftLoad(input: ComposerDraftLoadInput) {
  const queryClient = useQueryClient()
  const queryInput = input.target ?? { type: 'session' as const, sessionId: 'disabled' }
  const query = useQuery({
    ...trpc.composerDraftRead.queryOptions(queryInput),
    enabled: input.target !== null,
  })
  const [loaded, setLoaded] = useState<LoadedDraft | null>(null)
  const remember = useCallback(
    (owner: string, draft: DraftValue) => rememberComposerDraft(queryClient, owner, draft),
    [queryClient],
  )
  const cached = useCachedComposerDraft({ ...input, remember, setLoaded }, loaded?.owner ?? null)
  const current = loaded?.owner === input.owner ? loaded : cached
  useStartComposerDraftLoad({
    ...input,
    remember,
    loadedOwner: current?.owner ?? loaded?.owner ?? null,
    query,
    setLoaded,
  })
  const readTarget = query.data === undefined ? undefined : (query.data?.target ?? null)
  return {
    editing: current?.editing,
    loadedTarget: readTarget,
    failed: query.isError,
    hasDraft: current !== undefined,
    retry: () => query.refetch(),
  }
}

async function saveOrCreateDraft(input: {
  current: PersistedDraft | undefined
  target: DraftTarget
  content: DraftContent
  create: (value: RouterInputs['composerDraftCreate']) => Promise<DraftValue>
  save: (value: RouterInputs['composerDraftSave']) => Promise<DraftValue>
}): Promise<DraftValue> {
  const { current, target, content, create, save } = input
  if (current === undefined) return create({ target, content })
  try {
    return await save({ id: current.id, expectedRevision: current.revision, target, content })
  } catch (error) {
    if (!isTRPCClientError<AppRouter>(error) || error.data?.code !== 'NOT_FOUND') throw error
    return create({ target, content })
  }
}

function usePersistComposerDraft(input: {
  target: DraftTarget | null
  owner: string | null
  create: (input: RouterInputs['composerDraftCreate']) => Promise<DraftValue>
  save: (input: RouterInputs['composerDraftSave']) => Promise<DraftValue>
  persisted: React.RefObject<Map<string, PersistedDraft>>
  saveChain: React.RefObject<Promise<void>>
  queryClient: ReturnType<typeof useQueryClient>
  setSaveFailureOwner: React.Dispatch<React.SetStateAction<string | null>>
}) {
  const { target, owner, create, save, persisted, saveChain, queryClient, setSaveFailureOwner } =
    input
  return useCallback(
    (content: DraftContent) => {
      const operation = saveChain.current.then(async (): Promise<PersistedDraft> => {
        if (target === null || owner === null) throw new Error('Composer draft has no target.')
        const contentFingerprint = fingerprint(target, content)
        const current = persisted.current.get(owner)
        if (current?.fingerprint === contentFingerprint) return current
        const draft = await saveOrCreateDraft({ current, target, content, create, save })
        const next = {
          id: draft.id,
          revision: draft.revision,
          owner,
          fingerprint: contentFingerprint,
        }
        persisted.current.set(owner, next)
        queryClient.setQueryData(trpc.composerDraftRead.queryKey(target), draft)
        rememberComposerDraft(queryClient, owner, draft)
        setSaveFailureOwner((failedOwner) => (failedOwner === owner ? null : failedOwner))
        return next
      })
      saveChain.current = operation.then(
        () => undefined,
        () => undefined,
      )
      return operation
    },
    [create, owner, persisted, queryClient, save, saveChain, setSaveFailureOwner, target],
  )
}

function useComposerDraftAutosave(
  input: ComposerDraftActionInput & {
    initialFingerprints: React.RefObject<Map<string, string>>
    target: DraftTarget | null
    targetRestored: boolean
  },
) {
  const {
    persist,
    persisted,
    latestEditing,
    pendingSaves,
    owner,
    target,
    targetRestored,
    initialFingerprints,
    setSaveFailureOwner,
    suppressNextEmptyAutosave,
  } = input
  return useCallback(
    (editing: ComposerEditing) => {
      latestEditing.current = editing
      const content = contentFromEditing(editing)
      if (content === null || owner === null || target === null || !targetRestored) return
      if (suppressAcceptedEmptyDraft(owner, content, suppressNextEmptyAutosave)) return
      const currentFingerprint = fingerprint(target, content)
      if (currentFingerprint === persisted.current.get(owner)?.fingerprint) return
      if (initialFingerprints.current.has(owner)) {
        const baseline = initialFingerprints.current.get(owner)
        initialFingerprints.current.delete(owner)
        if (baseline === currentFingerprint) return
      }
      cancelPendingSave(pendingSaves, owner)
      const save = () => {
        if (pendingSaves.current.get(owner)?.save === save) pendingSaves.current.delete(owner)
        void persist(content).catch(() => {
          if (owner !== null) setSaveFailureOwner(owner)
        })
      }
      pendingSaves.current.set(owner, { timer: window.setTimeout(save, 250), save })
    },
    [
      initialFingerprints,
      latestEditing,
      owner,
      target,
      targetRestored,
      persist,
      persisted,
      pendingSaves,
      setSaveFailureOwner,
      suppressNextEmptyAutosave,
    ],
  )
}

// A caller builds its target each render; one kept per identity stops an unchanged edit re-saving.
function useTargetByIdentity(target: DraftTarget | null) {
  const identity = target === null ? null : JSON.stringify(target)
  const kept = useRef({ identity, target })
  if (kept.current.identity !== identity) kept.current = { identity, target }
  return kept.current.target
}

export function useDurableComposerDraft(input: DurableComposerDraftInput) {
  const { choices, opening, targetRestored } = input
  const target = useTargetByIdentity(input.target)
  const queryClient = useQueryClient()
  const { create, save, submitMutation } = useComposerDraftMutations()
  const owner = ownerKey(target)
  const persistence = useComposerDraftPersistence({
    target,
    owner,
    targetRestored,
    create,
    save,
    submitMutation,
    queryClient,
  })
  const load = useComposerDraftLoad({
    target,
    choices,
    opening,
    owner,
    targetRestored,
    create,
    persisted: persistence.persisted,
    latestEditing: persistence.latestEditing,
    initialFingerprints: persistence.initialFingerprints,
  })
  const initialEditing = load.editing
  const targetIdentity = target === null ? null : JSON.stringify(target)
  const editingChange = useRef(persistence.onEditingChange)
  editingChange.current = persistence.onEditingChange
  useEffect(() => {
    if (
      targetIdentity !== null &&
      targetRestored &&
      initialEditing !== undefined &&
      persistence.latestEditing.current !== null
    )
      editingChange.current(persistence.latestEditing.current)
  }, [initialEditing, targetIdentity, targetRestored, persistence.latestEditing])
  return load.editing === undefined &&
    !load.failed &&
    (targetRestored || load.loadedTarget === undefined)
    ? null
    : {
        initialEditing,
        loadedTarget: load.loadedTarget,
        loadFailed: load.failed,
        hasDraft: load.hasDraft,
        retryLoad: load.retry,
        onEditingChange: persistence.onEditingChange,
        submit: persistence.submit,
        saveFailed: persistence.saveFailed,
        sendFailure: persistence.sendFailure,
      }
}

// A reload drops timers, so a page hide sends every pending save now. A save queued behind an
// unanswered one still waits for it, since main rejects a stale revision.
function usePendingSaves() {
  const pendingSaves = useRef(new Map<string, PendingSave>())
  useEffect(() => {
    const sendPending = () => {
      for (const pending of pendingSaves.current.values()) {
        window.clearTimeout(pending.timer)
        pending.save()
      }
    }
    window.addEventListener('pagehide', sendPending)
    return () => window.removeEventListener('pagehide', sendPending)
  }, [])
  return pendingSaves
}

function useComposerDraftPersistence(input: {
  target: DraftTarget | null
  owner: string | null
  targetRestored: boolean
  create: (input: RouterInputs['composerDraftCreate']) => Promise<DraftValue>
  save: (input: RouterInputs['composerDraftSave']) => Promise<DraftValue>
  submitMutation: (input: RouterInputs['sessionSubmit']) => Promise<RouterOutputs['sessionSubmit']>
  queryClient: ReturnType<typeof useQueryClient>
}) {
  const { target, owner, targetRestored, create, save, submitMutation, queryClient } = input
  const persisted = useRef(new Map<string, PersistedDraft>())
  const initialFingerprints = useRef(new Map<string, string>())
  const [saveFailureOwner, setSaveFailureOwner] = useState<string | null>(null)
  const [sendFailure, setSendFailure] = useState<{
    owner: string
    outcome: 'rejected' | 'uncertain'
  } | null>(null)
  const latestEditing = useRef<ComposerEditing | null>(null)
  const saveChain = useRef<Promise<void>>(Promise.resolve())
  const pendingSaves = usePendingSaves()
  const suppressNextEmptyAutosave = useRef<string | null>(null)
  const persist = usePersistComposerDraft({
    target,
    owner,
    create,
    save,
    persisted,
    saveChain,
    queryClient,
    setSaveFailureOwner,
  })
  const onEditingChange = useComposerDraftAutosave({
    persist,
    persisted,
    latestEditing,
    pendingSaves,
    owner,
    target,
    targetRestored,
    initialFingerprints,
    setSaveFailureOwner,
    suppressNextEmptyAutosave,
  })
  const submit = useComposerDraftSubmit({
    persist,
    persisted,
    latestEditing,
    pendingSaves,
    submit: submitMutation,
    owner,
    setSaveFailureOwner,
    setSendFailure,
    suppressNextEmptyAutosave,
    clearAcceptedDraft: clearComposerDraftCache(target, owner, queryClient),
  })
  return {
    persisted,
    latestEditing,
    initialFingerprints,
    onEditingChange,
    submit,
    saveFailed: saveFailureOwner === owner,
    sendFailure: sendFailure?.owner === owner ? sendFailure.outcome : null,
  }
}

function clearComposerDraftCache(
  target: DraftTarget | null,
  owner: string | null,
  queryClient: ReturnType<typeof useQueryClient>,
) {
  return (saved: PersistedDraft) => {
    if (target === null || owner === null) return
    forgetComposerDraft(queryClient, owner, saved)
    queryClient.setQueryData<DraftValue | null>(
      trpc.composerDraftRead.queryKey(target),
      (current) =>
        current?.id === saved.id && current.revision === saved.revision ? null : current,
    )
  }
}

function useComposerDraftMutations() {
  const { mutateAsync: createDraft } = useMutation(trpc.composerDraftCreate.mutationOptions())
  const { mutateAsync: saveDraft } = useMutation(trpc.composerDraftSave.mutationOptions())
  const { mutateAsync: submitDraft } = useMutation(trpc.sessionSubmit.mutationOptions())
  return {
    create: useCallback(
      (value: RouterInputs['composerDraftCreate']) => createDraft(value),
      [createDraft],
    ),
    save: useCallback((value: RouterInputs['composerDraftSave']) => saveDraft(value), [saveDraft]),
    submitMutation: useCallback(
      (value: RouterInputs['sessionSubmit']) => submitDraft(value),
      [submitDraft],
    ),
  }
}
