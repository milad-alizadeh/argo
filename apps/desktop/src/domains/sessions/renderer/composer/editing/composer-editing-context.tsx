import {
  createContext,
  type Dispatch,
  type ReactNode,
  useContext,
  useEffect,
  useReducer,
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

export function ComposerEditingProvider({
  children,
  initial,
  onChange,
}: {
  children: ReactNode
  initial?: Partial<ComposerEditing>
  onChange?: (editing: ComposerEditing) => void
}) {
  const [editing, dispatch] = useReducer(editComposer, initial, composerEditing)
  useEffect(() => onChange?.(editing), [editing, onChange])
  return <ComposerEditingContext value={{ editing, dispatch }}>{children}</ComposerEditingContext>
}

export function useComposerEditing() {
  const value = useContext(ComposerEditingContext)
  if (value === null) throw new Error('ComposerEditingProvider is missing.')
  return value
}
