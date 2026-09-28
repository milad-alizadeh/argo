import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { attachmentKindOf } from '@/domains/sessions/api/attachments'
import { type RouterInputs, type RouterOutputs, trpc } from '@/platform/renderer/trpc-client'
import { invalidateSessionList } from '../../session-queries'
import type { ComposerEditing } from '../editing/composer-editing'
import {
  supportedConfiguration,
  type TurnConfiguration,
  type TurnConfigurationChoices,
} from '../turn-configuration/turn-configuration'
import { shouldLoadComposerDraft } from './composer-draft-load'
import { type ComposerDraftActionInput, useComposerDraftSubmit } from './composer-draft-submit'

export type DraftTarget = RouterInputs['composerDraftCreate']['target']
export type DraftContent = RouterInputs['composerDraftCreate']['content']
type DraftValue = RouterOutputs['composerDraftCreate']

type PersistedDraft = {
  id: string
  revision: number
  owner: string
  fingerprint: string
}
type DraftLoadDependencies = {
  create: (input: RouterInputs['composerDraftCreate']) => Promise<DraftValue>
  persisted: React.RefObject<Map<string, PersistedDraft>>
  latestEditing: React.RefObject<ComposerEditing | null>
  setLoaded: React.Dispatch<
    React.SetStateAction<{ owner: string; editing: ComposerEditing; target: DraftTarget } | null>
  >
  initialFingerprints: React.RefObject<Map<string, string>>
}
type ComposerDraftLoadInput = Omit<DraftLoadDependencies, 'setLoaded'> & {
  target: DraftTarget | null
  choices: TurnConfigurationChoices | null
  opening: TurnConfiguration | null
  owner: string | null
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
    turnConfiguration: supportedConfiguration(choices, draft.turnConfiguration, fallback),
  }
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
    const editing = editingFromDraft(draft, input.choices, input.opening)
    const content = contentFromEditing(editing)
    if (content === null) return
    const renderedFingerprint = fingerprint(draft.target, content)
    const storedContent: DraftContent = {
      prompt: draft.prompt,
      attachments: draft.attachments,
      ticketContext: draft.ticketContext,
      turnConfiguration: draft.turnConfiguration,
    }
    input.persisted.current.set(input.owner, {
      id: draft.id,
      revision: draft.revision,
      owner: input.owner,
      fingerprint: fingerprint(draft.target, storedContent),
    })
    input.initialFingerprints.current.set(input.owner, renderedFingerprint)
    input.latestEditing.current = editing
    input.setLoaded({ owner: input.owner, editing, target: draft.target })
  })()
  return () => {
    active = false
  }
}

function fingerprint(target: DraftTarget, content: DraftContent) {
  return JSON.stringify({ target, content })
}

function draftLoadIdentities(
  target: DraftTarget | null,
  choices: TurnConfigurationChoices | null,
  opening: TurnConfiguration | null,
) {
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

function useStartComposerDraftLoad(
  input: ComposerDraftLoadInput & {
    setLoaded: DraftLoadDependencies['setLoaded']
    loaded: { owner: string; editing: ComposerEditing; target: DraftTarget } | null
    query: {
      isPending: boolean
      isFetching: boolean
      isError: boolean
      data: DraftValue | null | undefined
    }
  },
) {
  const targetRef = useRef(input.target)
  const configurationRef = useRef({ choices: input.choices, opening: input.opening })
  targetRef.current = input.target
  configurationRef.current = { choices: input.choices, opening: input.opening }
  const { targetIdentity, choicesIdentity, openingIdentity } = draftLoadIdentities(
    input.target,
    input.choices,
    input.opening,
  )
  useEffect(() => {
    return startComposerDraftLoadEffect({
      create: input.create,
      persisted: input.persisted,
      latestEditing: input.latestEditing,
      initialFingerprints: input.initialFingerprints,
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
      loadedOwner: input.loaded?.owner ?? null,
      isPending: input.query.isPending,
      isFetching: input.query.isFetching,
      isError: input.query.isError,
      hasData: input.query.data !== undefined,
      draft: input.query.data ?? undefined,
      setLoaded: input.setLoaded,
    })
  }, [
    input.owner,
    targetIdentity,
    choicesIdentity,
    openingIdentity,
    input.loaded?.owner,
    input.query.data,
    input.query.isFetching,
    input.query.isError,
    input.query.isPending,
    input.create,
    input.persisted,
    input.latestEditing,
    input.initialFingerprints,
    input.setLoaded,
  ])
}

function useComposerDraftLoad(input: ComposerDraftLoadInput) {
  const queryInput = input.target ?? { type: 'session' as const, sessionId: 'disabled' }
  const query = useQuery({
    ...trpc.composerDraftRead.queryOptions(queryInput),
    enabled: input.target !== null && input.choices !== null && input.opening !== null,
  })
  const [loaded, setLoaded] = useState<{
    owner: string
    editing: ComposerEditing
    target: DraftTarget
  } | null>(null)
  useStartComposerDraftLoad({ ...input, loaded, query, setLoaded })
  const current = loaded?.owner === input.owner ? loaded : undefined
  return {
    editing: current?.editing,
    loadedTarget: current?.target,
    failed: query.isError,
    hasDraft: current !== undefined,
    retry: () => query.refetch(),
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
        const draft =
          current !== undefined
            ? await save({ id: current.id, expectedRevision: current.revision, target, content })
            : await create({ target, content })
        const next = {
          id: draft.id,
          revision: draft.revision,
          owner,
          fingerprint: contentFingerprint,
        }
        persisted.current.set(owner, next)
        queryClient.setQueryData(trpc.composerDraftRead.queryKey(target), draft)
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
    saveTimer,
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
      const currentTimer = saveTimer.current.get(owner)
      if (currentTimer !== undefined) window.clearTimeout(currentTimer)
      const timer = window.setTimeout(() => {
        if (saveTimer.current.get(owner) === timer) saveTimer.current.delete(owner)
        void persist(content).catch(() => {
          if (owner !== null) setSaveFailureOwner(owner)
        })
      }, 250)
      saveTimer.current.set(owner, timer)
    },
    [
      initialFingerprints,
      latestEditing,
      owner,
      target,
      targetRestored,
      persist,
      persisted,
      saveTimer,
      setSaveFailureOwner,
      suppressNextEmptyAutosave,
    ],
  )
}

export function useDurableComposerDraft(input: DurableComposerDraftInput) {
  const { target, choices, opening, targetRestored } = input
  const queryClient = useQueryClient()
  const { create, save, submitMutation } = useComposerDraftMutations(queryClient)
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
  return load.editing === undefined && !load.failed
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
        sendFailed: persistence.sendFailed,
      }
}

function useComposerDraftPersistence(input: {
  target: DraftTarget | null
  owner: string | null
  targetRestored: boolean
  create: (input: RouterInputs['composerDraftCreate']) => Promise<DraftValue>
  save: (input: RouterInputs['composerDraftSave']) => Promise<DraftValue>
  submitMutation: (input: RouterInputs['sessionSubmit']) => Promise<{ sessionId: string }>
  queryClient: ReturnType<typeof useQueryClient>
}) {
  const { target, owner, targetRestored, create, save, submitMutation, queryClient } = input
  const persisted = useRef(new Map<string, PersistedDraft>())
  const initialFingerprints = useRef(new Map<string, string>())
  const [saveFailureOwner, setSaveFailureOwner] = useState<string | null>(null)
  const [sendFailureOwner, setSendFailureOwner] = useState<string | null>(null)
  const latestEditing = useRef<ComposerEditing | null>(null)
  const saveChain = useRef<Promise<void>>(Promise.resolve())
  const saveTimer = useRef(new Map<string, number>())
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
    saveTimer,
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
    saveTimer,
    submit: submitMutation,
    owner,
    setSaveFailureOwner,
    setSendFailureOwner,
    suppressNextEmptyAutosave,
    clearAcceptedDraft: clearComposerDraftCache(target, queryClient),
  })
  return {
    persisted,
    latestEditing,
    initialFingerprints,
    onEditingChange,
    submit,
    saveFailed: saveFailureOwner === owner,
    sendFailed: sendFailureOwner === owner,
  }
}

function clearComposerDraftCache(
  target: DraftTarget | null,
  queryClient: ReturnType<typeof useQueryClient>,
) {
  return () => {
    if (target !== null) queryClient.setQueryData(trpc.composerDraftRead.queryKey(target), null)
  }
}

function useComposerDraftMutations(queryClient: ReturnType<typeof useQueryClient>) {
  const { mutateAsync: createDraft } = useMutation(trpc.composerDraftCreate.mutationOptions())
  const { mutateAsync: saveDraft } = useMutation(trpc.composerDraftSave.mutationOptions())
  const { mutateAsync: submitDraft } = useMutation(
    trpc.sessionSubmit.mutationOptions({
      onSuccess: () => invalidateSessionList(queryClient),
    }),
  )
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
