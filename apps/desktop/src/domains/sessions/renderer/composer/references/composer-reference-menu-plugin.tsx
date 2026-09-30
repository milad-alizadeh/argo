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
import type { ComposerCommandListing } from '@/domains/sessions/api/composer-commands'
import type { Harness } from '@/harnesses/harness'
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

function useReferenceChoices(
  draft: string,
  listing: ComposerCommandListing,
  editor: LexicalEditor,
) {
  const [selected, setSelected] = useState(0)
  const [dismissedDraft, setDismissedDraft] = useState<string | null>(null)
  const menu = dismissedDraft === draft ? null : referenceMenu(draft, listing)
  const choices = menu?.kind === 'choices' ? menu.choices : null
  const choose = (choice: ReferenceSuggestion) => {
    replaceActiveReference(editor, choice.source)
    setDismissedDraft(draft)
    setSelected(0)
  }
  const dismiss = () => {
    setDismissedDraft(draft)
    setSelected(0)
  }
  const move = (direction: 1 | -1) => {
    if (choices === null || choices.length === 0) return
    setSelected((current) => (current + direction + choices.length) % choices.length)
  }
  return { choices, choose, dismiss, menu, move, selected }
}

export function ComposerReferenceMenuPlugin({
  harness = null,
  disabled = false,
  draft,
  listing,
  onOpenChange,
}: {
  harness?: Harness | null
  disabled?: boolean
  draft: string
  listing: ComposerCommandListing
  onOpenChange: (open: boolean) => void
}) {
  const [editor] = useLexicalComposerContext()
  const reference = activeReference(draft)
  const menu = useReferenceChoices(
    disabled || reference?.trigger === '@' ? '' : draft,
    listing,
    editor,
  )
  const menuRef = useRef(menu)
  menuRef.current = menu
  useEffect(
    () =>
      editor.registerCommand(
        KEY_DOWN_COMMAND,
        (event) => {
          const current = menuRef.current
          if (current.menu === null) return false
          if (current.menu.kind === 'note') {
            if (event.key !== 'Escape') return false
            event.preventDefault()
            current.dismiss()
            return true
          }
          return referenceMenuKey({
            choices: current.menu.choices,
            event,
            onChoose: current.choose,
            onDismiss: current.dismiss,
            onMove: current.move,
            selected: current.selected,
          })
        },
        COMMAND_PRIORITY_HIGH,
      ),
    [editor],
  )
  const menuOpen = !disabled && menu.menu !== null
  useEffect(() => {
    onOpenChange(menuOpen)
  }, [menuOpen, onOpenChange])
  if (disabled || menu.menu === null) return null
  return (
    <ComposerReferenceMenu
      harness={harness}
      menu={menu.menu}
      onChoose={menu.choose}
      selected={menu.selected}
    />
  )
}
