import {
  createContext,
  type Dispatch,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useReducer,
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

const ComposerEditingContext = createContext<ComposerEditingContextValue | null>(null)

export function ComposerEditingProvider({
  children,
  initial,
  onChange,
}: {
  children: ReactNode
  initial?: Partial<ComposerEditing>
  onChange?: (editing: ComposerEditing) => void
}) {
  const [editing, dispatchEditing] = useReducer(editComposer, initial, composerEditing)
  const [failedAttachmentIds, setFailedAttachmentIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  )
  const markAttachmentErrors = useCallback((ids: string[]) => {
    setFailedAttachmentIds((current) => new Set([...current, ...ids]))
  }, [])
  const clearAttachmentErrors = useCallback((ids: string[]) => {
    setFailedAttachmentIds((current) => new Set([...current].filter((id) => !ids.includes(id))))
  }, [])
  const dispatch = useCallback<Dispatch<ComposerEditingEvent>>(
    (event) => {
      if (event.type === 'attachments.added') {
        const reattached = editing.attachments
          .filter((attachment) => event.paths.includes(attachment.path))
          .map((attachment) => attachment.id)
        clearAttachmentErrors(reattached)
      }
      if (event.type === 'attachment.removed') {
        clearAttachmentErrors([event.id])
      }
      if (event.type === 'send.accepted') {
        clearAttachmentErrors(event.sentIds)
      }
      dispatchEditing(event)
    },
    [clearAttachmentErrors, editing.attachments],
  )
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
