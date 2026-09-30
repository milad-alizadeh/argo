import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useLexicalTextEntity } from '@lexical/react/useLexicalTextEntity'
import type { EntityMatch } from '@lexical/text'
import { $getSelection, $isRangeSelection, type LexicalEditor, type TextNode } from 'lexical'
import { useCallback, useEffect } from 'react'
import type { SessionHarness } from '../../harness'
import { $createComposerReferenceNode, ComposerReferenceNode } from './composer-reference-node'
import {
  referenceInText,
  rememberComposerReferences,
  type SessionReference,
} from './session-reference'

function useCaretAfterReference(editor: LexicalEditor) {
  useEffect(
    () =>
      editor.registerUpdateListener(() => {
        const inside = editor.getEditorState().read(() => {
          const selection = $getSelection()
          return (
            $isRangeSelection(selection) &&
            selection.isCollapsed() &&
            selection.anchor.getNode() instanceof ComposerReferenceNode
          )
        })
        if (!inside) return
        editor.update(() => {
          const selection = $getSelection()
          if (!$isRangeSelection(selection) || !selection.isCollapsed()) return
          const node = selection.anchor.getNode()
          if (!(node instanceof ComposerReferenceNode)) return
          const parent = node.getParent()
          if (parent === null) return
          parent.select(node.getIndexWithinParent() + 1, node.getIndexWithinParent() + 1)
        })
      }),
    [editor],
  )
}

export function ComposerReferencePlugin({
  harness = null,
  references,
}: {
  harness?: SessionHarness | null
  references: readonly SessionReference[]
}) {
  rememberComposerReferences(references)
  const [editor] = useLexicalComposerContext()
  useCaretAfterReference(editor)
  const getMatch = useCallback(
    (text: string): EntityMatch | null => {
      const match = referenceInText(text, references)
      if (match === null) return null
      return { end: match.end, start: match.start }
    },
    [references],
  )
  useLexicalTextEntity(getMatch, ComposerReferenceNode, (textNode: TextNode) =>
    $createComposerReferenceNode(textNode.getTextContent(), harness),
  )
  return null
}
