import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { COMMAND_PRIORITY_HIGH, KEY_DOWN_COMMAND } from 'lexical'
import { useEffect } from 'react'

export function OpenContextPickerPlugin({ onOpen }: { onOpen: () => void }) {
  const [editor] = useLexicalComposerContext()
  useEffect(
    () =>
      editor.registerCommand(
        KEY_DOWN_COMMAND,
        (event) => {
          if (event?.key !== '@') return false
          event.preventDefault()
          onOpen()
          return true
        },
        COMMAND_PRIORITY_HIGH,
      ),
    [editor, onOpen],
  )
  return null
}
