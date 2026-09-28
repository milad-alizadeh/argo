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
  const [stored, setStored] = useState(() => ({ owner, editing: composerEditing(initial) }))
  const ownerEditing =
    stored.owner === owner ? stored : { owner, editing: composerEditing(initial) }
  if (ownerEditing !== stored) setStored(ownerEditing)
  const dispatch = useCallback(
    (event: ComposerEditingEvent) =>
      setStored((state) =>
        state.owner === owner ? { owner, editing: editComposer(state.editing, event) } : state,
      ),
    [owner],
  )
  const { editing } = ownerEditing
  useEffect(() => onChange?.(editing), [editing, onChange])
  return <ComposerEditingContext value={{ editing, dispatch }}>{children}</ComposerEditingContext>
}

export function useComposerEditing() {
  const value = useContext(ComposerEditingContext)
  if (value === null) throw new Error('ComposerEditingProvider is missing.')
  return value
}
