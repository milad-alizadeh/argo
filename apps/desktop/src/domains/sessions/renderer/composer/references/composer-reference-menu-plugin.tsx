import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $createTextNode,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_HIGH,
  KEY_DOWN_COMMAND,
  type LexicalEditor,
  type LexicalNode,
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
import { ComposerReferenceNode } from './composer-reference-node'

function replaceActiveReference(editor: LexicalEditor, source: string) {
  editor.update(() => {
    const selection = $getSelection()
    if (!$isRangeSelection(selection)) return
    const node = selection.anchor.getNode()
    const activeNode = adjacentActiveReference(node, selection.anchor.offset, source)
    if (activeNode !== null) {
      selectAfterReference(activeNode)
      return
    }
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

function adjacentActiveReference(node: LexicalNode, offset: number, source: string) {
  if (node instanceof ComposerReferenceNode && node.getTextContent() === source) return node
  if (offset !== 0) return null
  const parent = node.getParent()
  if (!$isElementNode(parent)) return null
  const siblings = parent.getChildren()
  const index = siblings.findIndex((sibling) => sibling.getKey() === node.getKey())
  const nextSibling = siblings[index + 1]
  return nextSibling instanceof ComposerReferenceNode && nextSibling.getTextContent() === source
    ? nextSibling
    : null
}

function selectAfterReference(reference: ComposerReferenceNode) {
  const following = reference.getNextSibling()
  if ($isTextNode(following)) {
    const text = following.getTextContent()
    if (text.length === 0) {
      following.select(0, 0)
      return
    }
    if (text.startsWith(' ')) {
      following.select(1, 1)
      return
    }
  }
  const separator = $createTextNode(' ')
  reference.insertAfter(separator)
  separator.select(1, 1)
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
