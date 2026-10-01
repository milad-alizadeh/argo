import { $convertFromMarkdownString, $convertToMarkdownString } from '@lexical/markdown'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { $createParagraphNode, $getRoot } from 'lexical'
import { useEffect, useRef } from 'react'
import { flushSync } from 'react-dom'
import { composerTransformers } from './session-composer-markdown'

const RESTORE_TAG = 'composer.restore'

export function initialComposerDocument(prompt: string) {
  return () => $convertFromMarkdownString(prompt, composerTransformers)
}

export function ComposerEditorAdapter({
  prompt,
  onPromptChange,
}: {
  prompt: string
  onPromptChange: (prompt: string) => void
}) {
  const [editor] = useLexicalComposerContext()
  const documentPrompt = useRef(prompt)
  const currentPrompt = useRef(prompt)
  const pendingPrompts = useRef<string[]>([])
  currentPrompt.current = prompt

  useEffect(() => {
    const echoedPrompt = pendingPrompts.current.indexOf(prompt)
    if (echoedPrompt !== -1) {
      pendingPrompts.current.splice(0, echoedPrompt + 1)
      return
    }
    if (prompt === documentPrompt.current) return
    pendingPrompts.current = []
    documentPrompt.current = prompt
    editor.update(
      () => {
        if (prompt === '') $getRoot().clear().append($createParagraphNode()).selectEnd()
        else $convertFromMarkdownString(prompt, composerTransformers)
      },
      { tag: RESTORE_TAG },
    )
  }, [editor, prompt])

  return (
    <OnChangePlugin
      onChange={(state, _editor, tags) => {
        if (tags.has(RESTORE_TAG)) return
        const markdown = state.read(() => $convertToMarkdownString(composerTransformers))
        documentPrompt.current = markdown
        if (markdown !== currentPrompt.current) {
          pendingPrompts.current.push(markdown)
          // Render now: an Enter in the next task sends the draft React holds, not the editor's (#3020).
          flushSync(() => onPromptChange(markdown))
        }
      }}
    />
  )
}
