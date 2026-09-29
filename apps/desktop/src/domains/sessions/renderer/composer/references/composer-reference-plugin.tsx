import { useLexicalTextEntity } from '@lexical/react/useLexicalTextEntity'
import type { EntityMatch } from '@lexical/text'
import type { TextNode } from 'lexical'
import { useCallback } from 'react'
import type { SessionHarness } from '../../harness/harnesses'
import { $createComposerReferenceNode, ComposerReferenceNode } from './composer-reference-node'
import {
  referenceInText,
  rememberComposerReferences,
  type SessionReference,
} from './session-reference'

export function ComposerReferencePlugin({
  harness = null,
  references,
}: {
  harness?: SessionHarness | null
  references: readonly SessionReference[]
}) {
  rememberComposerReferences(references)
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
