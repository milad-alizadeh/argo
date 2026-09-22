import { useLexicalTextEntity } from '@lexical/react/useLexicalTextEntity'
import type { EntityMatch } from '@lexical/text'
import type { TextNode } from 'lexical'
import type { SessionHarness } from '../../harness/harnesses'
import { $createComposerReferenceNode, ComposerReferenceNode } from './composer-reference-node'
import { referenceInText } from './session-reference'

function referenceMatch(text: string): EntityMatch | null {
  const match = referenceInText(text)
  if (match === null) return null
  return { end: match.end, start: match.start }
}

export function ComposerReferencePlugin({ harness = null }: { harness?: SessionHarness | null }) {
  useLexicalTextEntity(referenceMatch, ComposerReferenceNode, (textNode: TextNode) =>
    $createComposerReferenceNode(textNode.getTextContent(), harness),
  )
  return null
}
