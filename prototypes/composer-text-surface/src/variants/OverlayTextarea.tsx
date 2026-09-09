// PROTOTYPE — variant A. A real `<textarea>` for the editing, and a mirrored div BEHIND it doing
// the inking.
//
// The ticket rules the textarea out because it cannot colour a substring. That is true of the
// textarea's own text — so this variant makes the textarea's text invisible (`color:
// transparent`, caret kept), and paints an identical, identically-wrapped div under it that CAN
// carry spans. The reader sees the div; the caret, the selection, undo, the IME and every
// platform text behaviour belong to the textarea.
//
// The bet is that the mirror stays in register. Any disagreement between the two boxes — a font,
// a padding, a wrap — shows up as ink sliding off the words.

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { intentOf } from '../shared/keys'
import { commandMark } from '../shared/menu'
import type { SurfaceHandle, SurfaceProps, VariantNote } from '../shared/surface'

export const overlayNote: VariantNote = {
  key: 'A',
  name: 'Textarea + mirrored ink',
  dependency: null,
  free: [
    'Caret, selection, undo, IME and dead keys: all the platform textarea (undo not proved\n     by the harness — a synthetic ⌘Z never reaches the browser command layer).',
    'The value is a string. No document model, no serialisation, no node types.',
    'Screen readers get a real multi-line text control.',
    'Autocorrect and smart quotes are switched off with attributes, as in Swift.',
  ],
  handWork: [
    'A mirror div whose font, padding, wrap and line box match the textarea exactly.',
    'A hidden measuring span for the caret rect — the textarea will not give one.',
    'The scroll of the mirror kept in step with the textarea on every scroll event.',
    'The command mark computed and re-spanned on every keystroke.',
  ],
  costs: [
    'Two boxes that must agree. Any font or padding drift shows as ink off the words.',
    'The caret rect is a measurement, not an API — it is re-measured per keystroke.',
    'Only whole-line-independent decoration: no widgets, no inline chips, no images.',
    'Reports the caret rect from a layout effect on every render — a render loop unless the\n     host compares before setting state. All three DOM variants hit this.',
  ],
}

type Piece = { at: number; text: string; marked: boolean }

/**
 * The draft cut at the mark's edges and at the caret, so the ink and the measuring span can both
 * be placed without either one splitting the other.
 */
function pieces(draft: string, mark: [number, number] | null, caret: number): Piece[] {
  const cuts = [...new Set([0, caret, ...(mark ?? []), draft.length])].sort((a, b) => a - b)
  const out: Piece[] = []
  for (let i = 0; i < cuts.length - 1; i += 1) {
    const from = cuts[i] as number
    const to = cuts[i + 1] as number
    if (from === caret) out.push({ at: caret, text: '', marked: false })
    out.push({
      at: from,
      text: draft.slice(from, to),
      marked: !!mark && from >= mark[0] && to <= mark[1],
    })
  }
  if (caret >= draft.length) out.push({ at: caret, text: '', marked: false })
  return out
}

export function OverlayTextarea({
  handle,
  draft,
  placeholder,
  canRunCommands,
  onChange,
  onIntent,
  onCaretRect,
  onAttach,
}: SurfaceProps & { handle: React.RefObject<SurfaceHandle | null> }) {
  const area = useRef<HTMLTextAreaElement>(null)
  const mirror = useRef<HTMLDivElement>(null)
  const measure = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    handle.current = {
      setValue(text, caret) {
        const el = area.current
        if (!el) return
        el.value = text
        el.setSelectionRange(caret, caret)
        onChange(text, caret)
      },
      focus() {
        area.current?.focus()
      },
    }
  }, [handle, onChange])

  useEffect(() => {
    area.current?.focus()
  }, [])

  // Where the caret sits on screen. The textarea offers nothing, so the mirror is measured: a
  // span is put at the caret's offset and its own rect is the answer.
  const report = useCallback(() => {
    const el = area.current
    const box = measure.current
    if (!el || !box) return onCaretRect(null)
    const rect = box.getBoundingClientRect()
    onCaretRect({ left: rect.left, top: rect.top, bottom: rect.bottom })
  }, [onCaretRect])

  useLayoutEffect(report)

  // One line at rest, the content's own height as it grows, the ceiling past that.
  useLayoutEffect(() => {
    const el = area.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height =
      draft.length === 0 ? 'var(--field-line-height)' : `${Math.min(el.scrollHeight, 117)}px`
  }, [draft])

  const caret = area.current?.selectionStart ?? draft.length
  const mark = canRunCommands ? commandMark(draft) : null

  return (
    <div className="field" style={{ position: 'relative' }}>
      <div
        ref={mirror}
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'break-word',
          pointerEvents: 'none',
          font: 'inherit',
          lineHeight: 'inherit',
          color: 'var(--text-primary)',
        }}
      >
        {pieces(draft, mark, caret).map((piece, at) =>
          piece.at === caret && piece.text.length === 0 ? (
            // The caret's own position, measured rather than asked for.
            // biome-ignore lint/suspicious/noArrayIndexKey: prototype
            <span key={`caret-${at}`} ref={measure} style={{ display: 'inline-block', width: 0 }} />
          ) : (
            // biome-ignore lint/suspicious/noArrayIndexKey: prototype
            <span key={at} className={piece.marked ? 'command-mark' : undefined}>
              {piece.text}
            </span>
          ),
        )}
        {/* A trailing newline leaves no line box of its own; this keeps the mirror as tall. */}
        {'​'}
      </div>

      {draft.length === 0 && <div className="placeholder">{placeholder}</div>}

      <textarea
        ref={area}
        rows={1}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        aria-label={placeholder}
        defaultValue={draft}
        style={{
          position: 'relative',
          width: '100%',
          height: 'var(--field-line-height)',
          margin: 0,
          padding: 0,
          border: 'none',
          outline: 'none',
          resize: 'none',
          background: 'transparent',
          // The words are the mirror's. The caret is still this control's.
          color: 'transparent',
          caretColor: 'var(--text-primary)',
          font: 'inherit',
          lineHeight: 'inherit',
          overflow: 'hidden',
        }}
        onScroll={(event) => {
          if (mirror.current) mirror.current.scrollTop = event.currentTarget.scrollTop
        }}
        onChange={(event) => {
          onChange(event.currentTarget.value, event.currentTarget.selectionStart)
        }}
        onSelect={(event) => {
          onChange(event.currentTarget.value, event.currentTarget.selectionStart)
        }}
        onKeyDown={(event) => {
          const intent = intentOf(event)
          if (intent === 'pass') return
          if (onIntent(intent)) {
            event.preventDefault()
            return
          }
          // Newline is the textarea's own; every other unclaimed intent falls through too.
        }}
        onPaste={(event) => {
          const files = Array.from(event.clipboardData.files)
          if (files.length === 0) return
          event.preventDefault()
          onAttach(files.map((file) => file.name || 'pasted image'))
        }}
      />
    </div>
  )
}
