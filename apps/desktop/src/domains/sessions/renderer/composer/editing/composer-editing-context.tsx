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

// A new owner starts from its own initial edit in the same render, so the composer stays mounted
// and nothing edited for one owner reaches the next. An event dispatched for an earlier owner is
// dropped.
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
  const [owned, setOwned] = useState(() => ({ owner, editing: composerEditing(initial) }))
  const current = owned.owner === owner ? owned : { owner, editing: composerEditing(initial) }
  if (current !== owned) setOwned(current)
  const dispatch = useCallback(
    (event: ComposerEditingEvent) =>
      setOwned((state) =>
        state.owner === owner ? { owner, editing: editComposer(state.editing, event) } : state,
      ),
    [owner],
  )
  const { editing } = current
  useEffect(() => onChange?.(editing), [editing, onChange])
  return <ComposerEditingContext value={{ editing, dispatch }}>{children}</ComposerEditingContext>
}

export function useComposerEditing() {
  const value = useContext(ComposerEditingContext)
  if (value === null) throw new Error('ComposerEditingProvider is missing.')
  return value
}
