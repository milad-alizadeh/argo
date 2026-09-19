import { $createCodeNode, CodeNode } from '@lexical/code'
import { LinkNode } from '@lexical/link'
import { ListItemNode, ListNode } from '@lexical/list'
import { $convertFromMarkdownString } from '@lexical/markdown'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { HorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode'
import { DEFAULT_TRANSFORMERS } from '@lexical/react/LexicalMarkdownShortcutPlugin'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import {
  $getRoot,
  $getSelection,
  $isParagraphNode,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  KEY_DOWN_COMMAND,
  PASTE_COMMAND,
} from 'lexical'
import { useEffect } from 'react'
import { SKILL_MENTION_TRANSFORMER } from '@/domains/sessions/renderer/components/composer/references/skill-mention-markdown'
import { SkillMentionNode } from '@/domains/sessions/renderer/components/composer/references/skill-mention-node'

const MARKDOWN_PATTERN = /(^|\n)(#{1,6} |[-*+] |\d+\. |> |```)|\*\*.+\*\*|\[.+\]\(.+\)/

export const composerNodes = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  LinkNode,
  CodeNode,
  HorizontalRuleNode,
  SkillMentionNode,
]

// The skill transformer goes first: its pattern is a stricter match on the same `[...](...)`
// shape the stock LINK transformer also recognises, and the first match in the list wins.
export const composerTransformers = [SKILL_MENTION_TRANSFORMER, ...DEFAULT_TRANSFORMERS]

function isCodeFenceTrigger() {
  const selection = $getSelection()
  if (
    !$isRangeSelection(selection) ||
    !selection.isCollapsed() ||
    selection.anchor.type !== 'text'
  ) {
    return false
  }

  const text = selection.anchor.getNode()
  const paragraph = text.getParent()

  return (
    $isParagraphNode(paragraph) &&
    paragraph.getChildrenSize() === 1 &&
    text.getTextContent() === '``' &&
    selection.anchor.offset === 2
  )
}

export function MarkdownTypingShortcutPlugin() {
  const [editor] = useLexicalComposerContext()

  useEffect(
    () =>
      editor.registerCommand(
        KEY_DOWN_COMMAND,
        (event) => {
          if (event.key !== '`') return false

          const isTrigger = editor.getEditorState().read(isCodeFenceTrigger)
          if (!isTrigger) return false

          event.preventDefault()
          editor.update(() => {
            if (!isCodeFenceTrigger()) return
            const selection = $getSelection()
            if (!$isRangeSelection(selection)) return
            const paragraph = selection.anchor.getNode().getParent()
            if (!$isParagraphNode(paragraph)) return
            paragraph.replace($createCodeNode()).selectStart()
          })
          return true
        },
        COMMAND_PRIORITY_HIGH,
      ),
    [editor],
  )

  return null
}

export function MarkdownPastePlugin() {
  const [editor] = useLexicalComposerContext()

  useEffect(
    () =>
      editor.registerCommand(
        PASTE_COMMAND,
        (event) => {
          if (!('clipboardData' in event)) return false
          const markdown = event.clipboardData?.getData('text/plain')

          if (!markdown || !MARKDOWN_PATTERN.test(markdown)) return false

          const isEmpty = editor.getEditorState().read(() => !$getRoot().getTextContent().trim())
          if (!isEmpty) return false

          event.preventDefault()
          editor.update(() => $convertFromMarkdownString(markdown, composerTransformers))
          return true
        },
        COMMAND_PRIORITY_HIGH,
      ),
    [editor],
  )

  return null
}
