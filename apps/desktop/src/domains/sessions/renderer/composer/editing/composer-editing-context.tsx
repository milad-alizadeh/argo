import {
  createContext,
  type Dispatch,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import {
  type ComposerEditing,
  type ComposerEditingEvent,
  composerEditing,
  editComposer,
} from './composer-editing'

type ComposerEditingContextValue = {
  editing: ComposerEditing
  dispatch: Dispatch<ComposerEditingEvent>
  failedAttachmentIds: ReadonlySet<string>
  markAttachmentErrors: (ids: string[]) => void
}

type OwnerEditing = {
  owner: string
  editing: ComposerEditing
  failedAttachmentIds: ReadonlySet<string>
}

function ownerState(owner: string, initial: Partial<ComposerEditing> | undefined): OwnerEditing {
  return { owner, editing: composerEditing(initial), failedAttachmentIds: new Set() }
}

// Reattaching, removing or sending an attachment clears its error.
function clearedAttachmentIds(editing: ComposerEditing, event: ComposerEditingEvent): string[] {
  switch (event.type) {
    case 'attachments.added':
      return editing.attachments
        .filter((attachment) => event.paths.includes(attachment.path))
        .map((attachment) => attachment.id)
    case 'attachment.removed':
      return [event.id]
    case 'send.accepted':
      return event.sentIds
    default:
      return []
  }
}

function withoutErrors(failed: ReadonlySet<string>, ids: string[]): ReadonlySet<string> {
  if (!ids.some((id) => failed.has(id))) return failed
  return new Set([...failed].filter((id) => !ids.includes(id)))
}

const ComposerEditingContext = createContext<ComposerEditingContextValue | null>(null)

// A new owner starts from its own initial edit without a remount; an edit for an earlier owner is dropped.
export function ComposerEditingProvider({
  children,
  owner,
  initial,
  onChange,
}: {
  children: ReactNode
  owner: string
  initial?: Partial<ComposerEditing>
  onChange?: (editing: ComposerEditing) => void
}) {
  const [stored, setStored] = useState(() => ownerState(owner, initial))
  const ownerEditing = stored.owner === owner ? stored : ownerState(owner, initial)
  if (ownerEditing !== stored) setStored(ownerEditing)
  const dispatch = useCallback<Dispatch<ComposerEditingEvent>>(
    (event) =>
      setStored((state) =>
        state.owner === owner
          ? {
              owner,
              editing: editComposer(state.editing, event),
              failedAttachmentIds: withoutErrors(
                state.failedAttachmentIds,
                clearedAttachmentIds(state.editing, event),
              ),
            }
          : state,
      ),
    [owner],
  )
  const markAttachmentErrors = useCallback(
    (ids: string[]) =>
      setStored((state) =>
        state.owner === owner
          ? { ...state, failedAttachmentIds: new Set([...state.failedAttachmentIds, ...ids]) }
          : state,
      ),
    [owner],
  )
  const { editing, failedAttachmentIds } = ownerEditing
  useEffect(() => onChange?.(editing), [editing, onChange])
  return (
    <ComposerEditingContext
      value={{ editing, dispatch, failedAttachmentIds, markAttachmentErrors }}
    >
      {children}
    </ComposerEditingContext>
  )
}

export function useComposerEditing() {
  const value = useContext(ComposerEditingContext)
  if (value === null) throw new Error('ComposerEditingProvider is missing.')
  return value
}
