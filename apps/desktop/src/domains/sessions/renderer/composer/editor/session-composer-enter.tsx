import { $isListItemNode } from '@lexical/list'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  INSERT_PARAGRAPH_COMMAND,
  KEY_ENTER_COMMAND,
  type LexicalNode,
} from 'lexical'
import { useEffect } from 'react'

import {
  matchesChord,
  pressedKeys,
  SEND_MESSAGE_COMMAND,
  shortcut,
} from '@/platform/contract/commands'

const SEND_CHORD = shortcut(SEND_MESSAGE_COMMAND).chord

function selectionIsInListItem() {
  const selection = $getSelection()
  if (!$isRangeSelection(selection)) return false
  let node: LexicalNode | null = selection.anchor.getNode()
  while (node !== null) {
    if ($isListItemNode(node)) return true
    node = node.getParent()
  }
  return false
}

// Lexical inserts a paragraph on Enter's keydown, before any React handler runs, so this command
// claims both list continuation and send first (#1999).
export function SendOnEnterPlugin({ onSend }: { onSend: () => void }) {
  const [editor] = useLexicalComposerContext()

  useEffect(
    () =>
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        (event) => {
          // An IME confirms its composed text with this Enter; it is not a real keystroke the
          // reader typed, so it must neither send nor open a new paragraph (#e2e-real-cheap-models).
          if (event?.isComposing) {
            event.preventDefault()
            return true
          }
          if (event?.shiftKey === true && selectionIsInListItem()) {
            event.preventDefault()
            return editor.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined)
          }
          if (!event || !matchesChord(SEND_CHORD, pressedKeys(event))) {
            return false
          }
          event.preventDefault()
          onSend()
          return true
        },
        COMMAND_PRIORITY_HIGH,
      ),
    [editor, onSend],
  )

  return null
}
