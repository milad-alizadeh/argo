import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_HIGH,
  KEY_DOWN_COMMAND,
  type LexicalEditor,
} from 'lexical'
import { useEffect, useRef, useState } from 'react'

import type { SessionCli } from '../harness/harnesses'
import {
  activeReference,
  ComposerReferenceMenu,
  type ReferenceSuggestion,
  referenceMenu,
  referenceMenuKey,
} from './composer-reference-menu'

function replaceActiveReference(editor: LexicalEditor, source: string) {
  editor.update(() => {
    const selection = $getSelection()
    if (!$isRangeSelection(selection)) return
    const node = selection.anchor.getNode()
    if (!$isTextNode(node)) return
    const cursor = selection.anchor.offset
    const text = node.getTextContent()
    const active = activeReference(text.slice(0, cursor))
    if (active === null) return
    const before = `${text.slice(0, cursor - active.source.length)}${active.leading}${source} `
    node.setTextContent(`${before}${text.slice(cursor)}`)
    node.select(before.length, before.length)
  })
}

function useReferenceChoices(draft: string, editor: LexicalEditor) {
  const [selected, setSelected] = useState(0)
  const [dismissedDraft, setDismissedDraft] = useState<string | null>(null)
  const choices = referenceMenu(draft)
  const choose = (choice: ReferenceSuggestion) => {
    replaceActiveReference(editor, choice.source)
    setSelected(0)
  }
  const dismiss = () => {
    setDismissedDraft(draft)
    setSelected(0)
  }
  const move = (direction: 1 | -1) => {
    if (choices === null) return
    setSelected((current) => (current + direction + choices.length) % choices.length)
  }
  return { choices: dismissedDraft === draft ? null : choices, choose, dismiss, move, selected }
}

export function ComposerReferenceMenuPlugin({
  cli = null,
  disabled = false,
  draft,
}: {
  cli?: SessionCli | null
  disabled?: boolean
  draft: string
}) {
  const [editor] = useLexicalComposerContext()
  const menu = useReferenceChoices(disabled ? '' : draft, editor)
  const menuRef = useRef(menu)
  menuRef.current = menu
  useEffect(
    () =>
      editor.registerCommand(
        KEY_DOWN_COMMAND,
        (event) => {
          const currentMenu = menuRef.current
          return (
            currentMenu.choices !== null &&
            referenceMenuKey({
              choices: currentMenu.choices,
              event,
              onChoose: currentMenu.choose,
              onDismiss: currentMenu.dismiss,
              onMove: currentMenu.move,
              selected: currentMenu.selected,
            })
          )
        },
        COMMAND_PRIORITY_HIGH,
      ),
    [editor],
  )
  if (disabled || menu.choices === null) return null
  return (
    <ComposerReferenceMenu
      choices={menu.choices}
      cli={cli}
      onChoose={menu.choose}
      selected={menu.selected}
    />
  )
}
