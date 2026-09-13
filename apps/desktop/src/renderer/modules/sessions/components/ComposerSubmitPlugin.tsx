import { $createCodeNode } from '@lexical/code'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $createTextNode,
  $getSelection,
  $isParagraphNode,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_HIGH,
  KEY_ENTER_COMMAND,
  TextNode,
} from 'lexical'
import { useEffect } from 'react'

import { matchesShortcut, SEND_MESSAGE_COMMAND } from '@/core/commands/shortcuts'

function pressedKeys(event: KeyboardEvent) {
  return {
    alt: event.altKey,
    ctrl: event.ctrlKey,
    key: event.key,
    meta: event.metaKey,
    shift: event.shiftKey,
  }
}

function codeFenceLanguage() {
  const selection = $getSelection()
  if (!$isRangeSelection(selection)) return null
  const node = selection.anchor.getNode()
  if (!$isTextNode(node)) return null
  const match = /^[ \t]*```([\w-]*)$/.exec(
    node.getTextContent().slice(0, selection.anchor.offset).trimEnd(),
  )
  return match?.[1] ?? null
}

function replaceCodeFence(language: string) {
  const selection = $getSelection()
  if (!$isRangeSelection(selection)) return
  const node = selection.anchor.getNode()
  if (!$isTextNode(node)) return
  const paragraph = node.getParent()
  if (!$isParagraphNode(paragraph)) return
  const code = $createCodeNode(language || undefined)
  code.append($createTextNode())
  paragraph.replace(code)
  code.selectEnd()
}

function replaceBareCodeFence(node: TextNode) {
  const paragraph = node.getParent()
  if (!$isParagraphNode(paragraph) || paragraph.getTextContent().trim() !== '```') return
  const code = $createCodeNode()
  code.append($createTextNode())
  paragraph.replace(code)
  code.selectEnd()
}

export function ComposerSubmitPlugin({ onSend }: { onSend: () => void }) {
  const [editor] = useLexicalComposerContext()
  useEffect(() => {
    const unregisterCodeFence = editor.registerNodeTransform(TextNode, replaceBareCodeFence)
    const unregisterSubmit = editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => {
        if (event === null || event.isComposing) return false
        if (matchesShortcut(SEND_MESSAGE_COMMAND, pressedKeys(event))) {
          event.preventDefault()
          onSend()
          return true
        }
        const language = editor.getEditorState().read(codeFenceLanguage)
        if (language === null) return false
        event.preventDefault()
        editor.update(() => replaceCodeFence(language))
        return true
      },
      COMMAND_PRIORITY_HIGH,
    )
    return () => {
      unregisterCodeFence()
      unregisterSubmit()
    }
  }, [editor, onSend])
  return null
}
