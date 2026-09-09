// PROTOTYPE — variant B. A `contenteditable` div, inked by hand.
//
// The model is a plain string, as in Swift. After every input the DOM is rebuilt from that string
// as spans, and the caret is put back by character offset. That rebuild is the whole variant: it
// is what buys arbitrary inking, and it is what costs everything a rebuild costs — the IME, the
// undo stack, and a re-entrancy hazard on every keystroke.

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { intentOf } from '../shared/keys'
import { commandMark } from '../shared/menu'
import type { SurfaceHandle, SurfaceProps, VariantNote } from '../shared/surface'

export const handInkedNote: VariantNote = {
  key: 'B',
  name: 'contenteditable, inked by hand',
  dependency: null,
  free: [
    'Arbitrary inking: any span, any colour, and widgets later if they are wanted.',
    'The caret rect is a Range away — no measurement, no mirror.',
    'No runtime dependency and no document model to learn.',
  ],
  handWork: [
    'Read the DOM back to a string, normalising <br> and the block wrappers browsers insert.',
    'Rebuild the DOM from the string and restore the caret by character offset, per keystroke.',
    'Guard the rebuild during an IME composition or the composition is cut off at the first key.',
    'Intercept paste to strip formatting, and Shift-Return to insert a real newline.',
    'A trailing newline needs a zero-width node or the last line has no box.',
  ],
  costs: [
    'The browser undo stack is expected to die the moment the DOM is rebuilt under it — not\n     proved by the harness, which cannot reach the browser’s own ⌘Z.',
    'Backspacing a draft empty leaves a stray newline in the model: the harness measured "\\n"\n     where the other three measured "". A rebuild disagrees with the browser about what a\n     delete at a boundary leaves.',
    'Every browser disagrees about what Enter, paste and delete leave in the DOM.',
    'IME and dead keys work only because the rebuild is suppressed — a hole to keep re-proving.',
    'Selection across a rebuild is fragile: this variant restores a caret, not a selection.',
  ],
}

/** The DOM read back as the plain string the model is. */
function readText(root: HTMLElement): string {
  let out = ''
  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        if ((child.parentElement as HTMLElement | null)?.dataset.ignore) continue
        out += child.nodeValue ?? ''
      } else if (child instanceof HTMLBRElement) {
        out += '\n'
      } else if (child instanceof HTMLElement) {
        // A browser that wrapped a line in a block leaves the newline implicit.
        if (out.length > 0 && ['DIV', 'P'].includes(child.tagName)) out += '\n'
        walk(child)
      }
    }
  }
  walk(root)
  return out
}

/** Where the caret is, as an offset into that string. */
function caretOffset(root: HTMLElement): number {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return 0
  const range = selection.getRangeAt(0).cloneRange()
  range.selectNodeContents(root)
  range.setEnd(selection.focusNode as Node, selection.focusOffset)
  const box = document.createElement('div')
  box.appendChild(range.cloneContents())
  return readText(box).length
}

/** Put the caret back at an offset, after the DOM under it has been replaced. */
function placeCaret(root: HTMLElement, offset: number) {
  const selection = window.getSelection()
  if (!selection) return
  let left = offset
  const walk = (node: Node): boolean => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        if ((child.parentElement as HTMLElement | null)?.dataset.ignore) continue
        const length = (child.nodeValue ?? '').length
        if (left <= length) {
          const range = document.createRange()
          range.setStart(child, left)
          range.collapse(true)
          selection.removeAllRanges()
          selection.addRange(range)
          return true
        }
        left -= length
      } else if (child instanceof HTMLElement && walk(child)) {
        return true
      }
    }
    return false
  }
  if (!walk(root)) {
    const range = document.createRange()
    range.selectNodeContents(root)
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)
  }
}

/** The string rendered as spans: the command mark in the accent, everything else plain. */
function paint(root: HTMLElement, text: string, mark: [number, number] | null) {
  root.textContent = ''
  const push = (slice: string, marked: boolean) => {
    if (slice.length === 0) return
    const span = document.createElement('span')
    if (marked) span.className = 'command-mark'
    span.textContent = slice
    root.appendChild(span)
  }
  if (mark) {
    push(text.slice(0, mark[0]), false)
    push(text.slice(mark[0], mark[1]), true)
    push(text.slice(mark[1]), false)
  } else {
    push(text, false)
  }
  // A trailing newline leaves no line box of its own.
  const tail = document.createElement('span')
  tail.dataset.ignore = 'true'
  tail.textContent = '​'
  root.appendChild(tail)
}

export function HandInked({
  handle,
  draft,
  placeholder,
  canRunCommands,
  onChange,
  onIntent,
  onCaretRect,
  onAttach,
}: SurfaceProps & { handle: React.RefObject<SurfaceHandle | null> }) {
  const field = useRef<HTMLDivElement>(null)
  const composing = useRef(false)

  const render = useCallback(
    (text: string, caret: number) => {
      const root = field.current
      if (!root) return
      paint(root, text, canRunCommands ? commandMark(text) : null)
      placeCaret(root, caret)
    },
    [canRunCommands],
  )

  useEffect(() => {
    handle.current = {
      setValue(text, caret) {
        render(text, caret)
        onChange(text, caret)
      },
      focus() {
        field.current?.focus()
      },
    }
  }, [handle, render, onChange])

  useEffect(() => {
    field.current?.focus()
  }, [])

  const report = useCallback(() => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return onCaretRect(null)
    const rect = selection.getRangeAt(0).getBoundingClientRect()
    if (rect.top === 0 && rect.left === 0) {
      const box = field.current?.getBoundingClientRect()
      return onCaretRect(box ? { left: box.left, top: box.top, bottom: box.bottom } : null)
    }
    onCaretRect({ left: rect.left, top: rect.top, bottom: rect.bottom })
  }, [onCaretRect])

  useLayoutEffect(report)

  const pull = useCallback(() => {
    const root = field.current
    if (!root || composing.current) return
    const text = readText(root)
    const caret = caretOffset(root)
    // The re-ink: the DOM is rebuilt under the caret on every keystroke.
    render(text, caret)
    onChange(text, caret)
  }, [render, onChange])

  return (
    <div className="field">
      {draft.length === 0 && <div className="placeholder">{placeholder}</div>}
      <div
        ref={field}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        tabIndex={0}
        aria-multiline="true"
        aria-label={placeholder}
        spellCheck={false}
        style={{
          outline: 'none',
          whiteSpace: 'pre-wrap',
          overflowWrap: 'break-word',
          minHeight: 'var(--field-line-height)',
        }}
        onInput={pull}
        onCompositionStart={() => {
          composing.current = true
        }}
        onCompositionEnd={() => {
          composing.current = false
          pull()
        }}
        onKeyUp={report}
        onMouseUp={() => {
          const root = field.current
          if (root) onChange(readText(root), caretOffset(root))
        }}
        onKeyDown={(event) => {
          const intent = intentOf(event)
          if (intent === 'pass') return
          if (onIntent(intent)) {
            event.preventDefault()
            return
          }
          if (intent === 'newline') {
            // Written into the model rather than left to the browser, so no <br> or <div> ever
            // reaches the DOM and the string stays the only truth.
            event.preventDefault()
            const root = field.current
            if (!root) return
            const text = readText(root)
            const at = caretOffset(root)
            const next = `${text.slice(0, at)}\n${text.slice(at)}`
            render(next, at + 1)
            onChange(next, at + 1)
            return
          }
          if (intent === 'submit') event.preventDefault()
        }}
        onPaste={(event) => {
          const files = Array.from(event.clipboardData.files)
          if (files.length > 0) {
            event.preventDefault()
            onAttach(files.map((file) => file.name || 'pasted image'))
            return
          }
          // Plain text only: a pasted style would survive the rebuild as markup.
          event.preventDefault()
          const root = field.current
          if (!root) return
          const words = event.clipboardData.getData('text/plain')
          const text = readText(root)
          const at = caretOffset(root)
          const next = text.slice(0, at) + words + text.slice(at)
          render(next, at + words.length)
          onChange(next, at + words.length)
        }}
      />
    </div>
  )
}
