// PROTOTYPE — variant C. Lexical, in plain-text mode.
//
// The editor owns a document model. The inking is a node transform that splits the first text
// node at the command mark and styles the head; the keys are one critical-priority command
// listener; the draft is read back out as a string on every update.

import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin'
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_CRITICAL,
  INSERT_LINE_BREAK_COMMAND,
  KEY_DOWN_COMMAND,
  type LexicalNode,
  PASTE_COMMAND,
  TextNode,
} from 'lexical'
import { useCallback, useEffect, useLayoutEffect } from 'react'
import { intentOf } from '../shared/keys'
import { commandMark } from '../shared/menu'
import type { SurfaceHandle, SurfaceProps, VariantNote } from '../shared/surface'

export const lexicalNote: VariantNote = {
  key: 'C',
  name: 'Lexical (plain text)',
  dependency: 'lexical + @lexical/react — about 30 kB gzipped',
  free: [
    'A real undo stack that survives the inking, because the inking is a model edit.',
    'IME, dead keys and selection are the editor’s problem, and it has solved them.',
    'Node transforms re-ink on the model, so the DOM is never rebuilt under the caret.',
    'Decorator nodes are there later for inline chips, attachments and mentions as objects.',
  ],
  handWork: [
    'A TextNode transform that splits the head at the mark and styles it.',
    'The caret offset computed by walking the model — a document has no single string index.',
    'A critical-priority KEY_DOWN listener so the composer’s keys beat the editor’s own.',
    'setValue implemented as a full editor.update that rebuilds the root.',
  ],
  costs: [
    'A document model to hold in your head, and a string that is now derived, not owned.',
    'Its own vocabulary for everything: commands, priorities, transforms, node replacement.',
    'A dependency that pins the composer to somebody else’s release cadence.',
  ],
}

const theme = { paragraph: 'lex-paragraph' }

/** The model read back as the plain string the host owns, and where the caret sits in it. */
function $readState(): { text: string; caret: number } {
  const text = $getRoot().getTextContent()
  const selection = $getSelection()
  if (!$isRangeSelection(selection)) return { text, caret: text.length }
  let caret = 0
  let found = false
  const walk = (nodes: LexicalNode[]) => {
    for (const node of nodes) {
      if (found) return
      if (node.getKey() === selection.anchor.key) {
        caret += selection.anchor.offset
        found = true
        return
      }
      if ($isElementNode(node)) {
        walk(node.getChildren())
      } else {
        caret += node.getTextContent().length
      }
    }
  }
  walk($getRoot().getChildren())
  return { text, caret: found ? caret : text.length }
}

function Plugin({
  handle,
  onChange,
  onIntent,
  onCaretRect,
  onAttach,
  canRunCommands,
}: Pick<SurfaceProps, 'onChange' | 'onIntent' | 'onCaretRect' | 'onAttach' | 'canRunCommands'> & {
  handle: React.RefObject<SurfaceHandle | null>
}) {
  const [editor] = useLexicalComposerContext()

  const report = useCallback(() => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return onCaretRect(null)
    const rect = selection.getRangeAt(0).getBoundingClientRect()
    if (rect.top === 0 && rect.left === 0) return onCaretRect(null)
    onCaretRect({ left: rect.left, top: rect.top, bottom: rect.bottom })
  }, [onCaretRect])

  useLayoutEffect(report)

  // The ink, as a model edit: the head of the first text node is split off and styled, so the
  // caret and the undo stack ride through it untouched.
  useEffect(() => {
    if (!canRunCommands) return
    return editor.registerNodeTransform(TextNode, (node) => {
      const accent = 'color: var(--accent);'
      const paragraph = $getRoot().getFirstChild()
      const first = $isElementNode(paragraph) ? paragraph.getFirstChild() : null
      const isHead = first !== null && first.getKey() === node.getKey()
      if (!isHead) {
        if (node.getStyle() === accent) node.setStyle('')
        return
      }
      const text = node.getTextContent()
      const mark = commandMark($getRoot().getTextContent())
      if (!mark) {
        if (node.getStyle() === accent) node.setStyle('')
        return
      }
      // The head node must hold EXACTLY the mark. Typing at the end of a styled node puts the new
      // characters in a fresh unstyled sibling, so the head falls behind the mark by a character
      // per keystroke and has to be topped back up from that sibling.
      if (text.length > mark[1]) {
        const [head] = node.splitText(mark[1])
        if (head && head.getStyle() !== accent) head.setStyle(accent)
        return
      }
      if (text.length < mark[1]) {
        const next = node.getNextSibling()
        if ($isTextNode(next)) {
          const wanted = mark[1] - text.length
          const rest = next.getTextContent()
          node.setTextContent(text + rest.slice(0, wanted))
          if (rest.length > wanted) next.setTextContent(rest.slice(wanted))
          else next.remove()
        }
      }
      if (node.getStyle() !== accent) node.setStyle(accent)
    })
  }, [editor, canRunCommands])

  useEffect(
    () =>
      editor.registerUpdateListener(({ editorState }) => {
        const next = editorState.read($readState)
        onChange(next.text, next.caret)
      }),
    [editor, onChange],
  )

  // Critical priority: the composer's meaning for a key beats the editor's own.
  useEffect(
    () =>
      editor.registerCommand(
        KEY_DOWN_COMMAND,
        (event: KeyboardEvent) => {
          const intent = intentOf(event)
          if (intent === 'pass') return false
          if (onIntent(intent)) {
            event.preventDefault()
            return true
          }
          if (intent === 'newline') {
            event.preventDefault()
            editor.dispatchCommand(INSERT_LINE_BREAK_COMMAND, false)
            return true
          }
          return intent === 'submit'
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
    [editor, onIntent],
  )

  useEffect(
    () =>
      editor.registerCommand(
        PASTE_COMMAND,
        (event: ClipboardEvent) => {
          const files = Array.from(event.clipboardData?.files ?? [])
          if (files.length === 0) return false
          event.preventDefault()
          onAttach(files.map((file) => file.name || 'pasted image'))
          return true
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
    [editor, onAttach],
  )

  useEffect(() => {
    handle.current = {
      setValue(text, caret) {
        editor.update(() => {
          const root = $getRoot()
          root.clear()
          const paragraph = $createParagraphNode()
          const node = $createTextNode(text)
          paragraph.append(node)
          root.append(paragraph)
          if (text.length > 0)
            node.select(Math.min(caret, text.length), Math.min(caret, text.length))
          else paragraph.select()
        })
      },
      focus() {
        editor.focus()
      },
    }
  }, [editor, handle])

  useEffect(() => {
    editor.focus()
  }, [editor])

  return null
}

export function LexicalSurface(
  props: SurfaceProps & { handle: React.RefObject<SurfaceHandle | null> },
) {
  const { draft, placeholder } = props
  return (
    <LexicalComposer
      initialConfig={{
        namespace: 'composer-prototype',
        theme,
        onError(error: Error) {
          throw error
        },
        nodes: [],
      }}
    >
      <div className="field">
        {draft.length === 0 && <div className="placeholder">{placeholder}</div>}
        <PlainTextPlugin
          contentEditable={
            <ContentEditable
              aria-label={placeholder}
              spellCheck={false}
              style={{
                outline: 'none',
                whiteSpace: 'pre-wrap',
                overflowWrap: 'break-word',
                minHeight: 'var(--field-line-height)',
              }}
            />
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <Plugin {...props} />
      </div>
    </LexicalComposer>
  )
}
