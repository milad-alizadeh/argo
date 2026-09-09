// PROTOTYPE (#1754). Four composer text surfaces on one route, switched by `?variant=`.
//
// The host owns the draft, the caret, the menus, the cursor and the keys' MEANING. Each variant
// owns the text surface itself: the inking, the caret, the key delivery and where the caret sits
// on screen. That split is the comparison — everything above the surface is identical, so what
// differs on screen is the surface.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyIntent } from './shared/keys'
import { Menu } from './shared/MenuSurface'
import { type CatalogState, commandMark, listingFor, type Row, rowsOf, taken } from './shared/menu'
import { Switcher } from './shared/Switcher'
import type { CaretRect, SurfaceHandle, SurfaceProps, VariantNote } from './shared/surface'
import { CodeMirrorSurface, codeMirrorNote } from './variants/CodeMirrorSurface'
import { HandInked, handInkedNote } from './variants/HandInked'
import { LexicalSurface, lexicalNote } from './variants/LexicalSurface'
import { OverlayTextarea, overlayNote } from './variants/OverlayTextarea'

type Variant = {
  note: VariantNote
  Surface: React.ComponentType<SurfaceProps & { handle: React.RefObject<SurfaceHandle | null> }>
}

const variants: Record<string, Variant> = {
  A: { note: overlayNote, Surface: OverlayTextarea },
  B: { note: handInkedNote, Surface: HandInked },
  C: { note: lexicalNote, Surface: LexicalSurface },
  D: { note: codeMirrorNote, Surface: CodeMirrorSurface },
}

const keys = Object.keys(variants)
const names = Object.fromEntries(Object.entries(variants).map(([k, v]) => [k, v.note.name]))

const placeholder = 'Say something to this Session'

export function App() {
  const [variant, setVariant] = useState(() => {
    const asked = new URLSearchParams(window.location.search).get('variant')
    return asked && keys.includes(asked) ? asked : 'A'
  })

  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('variant', variant)
    window.history.replaceState(null, '', url)
  }, [variant])

  return (
    <>
      <Stage key={variant} variant={variant} />
      <Switcher keys={keys} names={names} current={variant} onChange={setVariant} />
    </>
  )
}

function Stage({ variant }: { variant: string }) {
  const { Surface, note } = variants[variant] as Variant
  const handle = useRef<SurfaceHandle | null>(null)

  const [draft, setDraft] = useState('')
  const [caret, setCaret] = useState(0)
  const [caretRect, setCaretRect] = useState<CaretRect>(null)
  const [dismissed, setDismissed] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [cursor, setCursor] = useState(0)
  // Identity, not position: an index is not a key when the list grows at either end.
  const nextId = useRef(0)
  const [attachments, setAttachments] = useState<{ id: number; name: string }[]>([])
  const [sent, setSent] = useState<{ id: number; line: string }[]>([])
  const [lastKey, setLastKey] = useState<KeyIntent | '—'>('—')
  const [dropping, setDropping] = useState(false)

  // The slower half of the catalog, so the pinned status strip has something true to say.
  const [catalog, setCatalog] = useState<CatalogState>({ builtinsRead: false, filesFailed: true })
  useEffect(() => {
    const at = window.setTimeout(() => setCatalog({ builtinsRead: true, filesFailed: true }), 1400)
    return () => window.clearTimeout(at)
  }, [])

  const listing = useMemo(
    () => (dismissed ? null : listingFor(draft, caret, catalog, addOpen)),
    [draft, caret, catalog, addOpen, dismissed],
  )
  const rows = listing ? rowsOf(listing) : []

  // A different listing starts its walk at the top row; the same one keeps the walk.
  const listingKey = listing ? `${listing.sigil.mark}:${listing.query}` : ''
  const walked = useRef(listingKey)
  useEffect(() => {
    if (walked.current === listingKey) return
    walked.current = listingKey
    setCursor(0)
  }, [listingKey])

  const mark = commandMark(draft)

  // Three of the four surfaces report the caret rect from a layout effect that runs on every
  // render, so a new object every time is a render loop. Only a MOVED caret is news.
  const onCaretRect = useCallback((rect: CaretRect) => {
    setCaretRect((was) => {
      if (was === rect) return was
      if (!was || !rect) return rect
      const same = was.left === rect.left && was.top === rect.top && was.bottom === rect.bottom
      return same ? was : rect
    })
  }, [])

  const onChange = useCallback((text: string, at: number) => {
    setDraft(text)
    setCaret(at)
    setDismissed(false)
    setAddOpen(false)
  }, [])

  const send = useCallback(() => {
    if (draft.trim().length === 0 && attachments.length === 0) return
    nextId.current += 1
    setSent((was) => [...was, { id: nextId.current, line: draft }])
    setAttachments([])
    setDraft('')
    setCaret(0)
    handle.current?.setValue('', 0)
  }, [draft, attachments])

  const pick = useCallback(
    (row: Row) => {
      if (!listing) return
      const next = taken(draft, caret, { text: row.insert, dropping: listing.dropping })
      setDraft(next.text)
      setCaret(next.caret)
      setAddOpen(false)
      handle.current?.setValue(next.text, next.caret)
      handle.current?.focus()
    },
    [listing, draft, caret],
  )

  const onIntent = useCallback(
    (intent: KeyIntent) => {
      setLastKey(intent)
      const open = listing !== null
      switch (intent) {
        case 'submit':
          if (open && rows.length > 0) {
            pick(rows[cursor] as Row)
            return true
          }
          send()
          return true
        case 'walkDown':
          if (!open || rows.length === 0) return false
          setCursor((was) => (was + 1) % rows.length)
          return true
        case 'walkUp':
          if (!open || rows.length === 0) return false
          setCursor((was) => (was - 1 + rows.length) % rows.length)
          return true
        case 'complete':
          if (!open || rows.length === 0) return false
          pick(rows[cursor] as Row)
          return true
        case 'dismiss':
          if (!open) return false
          setDismissed(true)
          setAddOpen(false)
          return true
        default:
          return false
      }
    },
    [listing, rows, cursor, pick, send],
  )

  const onAttach = useCallback((names: string[]) => {
    setAttachments((was) => [
      ...was,
      ...names.map((name) => {
        nextId.current += 1
        return { id: nextId.current, name }
      }),
    ])
  }, [])

  return (
    <div className="deck">
      <div className="stage">
        <div className="feed">
          <div className="feed-row">
            <span className="mark">14:02</span>
            <span className="body">
              Session <code>argo/#1754-composer-text-surface</code> · idle. The feed is here for
              density only — the question is the vessel.
            </span>
          </div>
          {sent.map((turn) => (
            <div className="feed-row sent" key={turn.id}>
              <span className="mark">›</span>
              <span className="body">{turn.line}</span>
            </div>
          ))}
        </div>

        <div className="vessel-wrap">
          <section
            className={`vessel ${dropping ? 'dropping' : ''}`}
            aria-label="Composer"
            onDragOver={(event) => {
              event.preventDefault()
              setDropping(true)
            }}
            onDragLeave={() => setDropping(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDropping(false)
              onAttach(Array.from(event.dataTransfer.files).map((file) => file.name))
            }}
          >
            {attachments.length > 0 && (
              <div className="chips">
                {attachments.map((chip) => (
                  <span className="chip" key={chip.id}>
                    {chip.name}
                    <button
                      type="button"
                      aria-label={`Remove ${chip.name}`}
                      onClick={() =>
                        setAttachments((was) => was.filter((one) => one.id !== chip.id))
                      }
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            <Surface
              handle={handle}
              draft={draft}
              placeholder={placeholder}
              canRunCommands
              onChange={onChange}
              onIntent={onIntent}
              onCaretRect={onCaretRect}
              onAttach={onAttach}
            />

            <div className="footer">
              <button
                type="button"
                aria-label="Add to this Turn"
                onClick={() => {
                  setAddOpen((was) => !was)
                  setDismissed(false)
                  handle.current?.focus()
                }}
              >
                +
              </button>
              <span className="hint">⏎ sends · ⇧⏎ new line · ⇥ completes · esc dismisses</span>
              <span className="spacer" />
              <button
                type="button"
                className="send"
                disabled={draft.trim().length === 0 && attachments.length === 0}
                onClick={send}
              >
                ↑
              </button>
            </div>
          </section>
        </div>

        {listing && <Menu listing={listing} cursor={cursor} caret={caretRect} onPick={pick} />}
      </div>

      <Readout
        note={note}
        draft={draft}
        caret={caret}
        mark={mark}
        listing={listing}
        cursor={cursor}
        rows={rows.length}
        lastKey={lastKey}
        caretRect={caretRect}
      />
    </div>
  )
}

function Readout({
  note,
  draft,
  caret,
  mark,
  listing,
  cursor,
  rows,
  lastKey,
  caretRect,
}: {
  note: VariantNote
  draft: string
  caret: number
  mark: [number, number] | null
  listing: ReturnType<typeof listingFor>
  cursor: number
  rows: number
  lastKey: string
  caretRect: CaretRect
}) {
  return (
    <div className="readout">
      <h2>
        {note.key} · {note.name}
      </h2>
      <div className="dep">{note.dependency ?? 'no runtime dependency'}</div>

      <h3>State</h3>
      <dl>
        <dt>draft</dt>
        <dd>{JSON.stringify(draft)}</dd>
        <dt>caret</dt>
        <dd>{caret}</dd>
        <dt>command mark</dt>
        <dd>
          {mark
            ? `${mark[0]}..${mark[1]} ${JSON.stringify(draft.slice(mark[0], mark[1]))}`
            : 'none'}
        </dd>
        <dt>menu</dt>
        <dd>{listing ? `${listing.sigil.mark} q=${JSON.stringify(listing.query)}` : 'closed'}</dd>
        <dt>rows</dt>
        <dd>{listing ? `${rows} · cursor ${cursor}` : '—'}</dd>
        <dt>dropping</dt>
        <dd>{listing ? listing.dropping : '—'}</dd>
        <dt>last key</dt>
        <dd>{lastKey}</dd>
        <dt>caret rect</dt>
        <dd>
          {caretRect ? `${Math.round(caretRect.left)}, ${Math.round(caretRect.top)}` : 'unknown'}
        </dd>
      </dl>

      <h3>Free</h3>
      <ul>
        {note.free.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>

      <h3>Hand-written</h3>
      <ul>
        {note.handWork.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>

      <h3>Costs</h3>
      <ul>
        {note.costs.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>

      <h3>Script</h3>
      <ul>
        <li>
          Type <code>/imp</code> — the menu opens, the matched characters ink, the mark inks in the
          line.
        </li>
        <li>⇥ or ⏎ picks. esc dismisses and leaves the line sendable.</li>
        <li>
          <code>@Composer</code> opens the file menu at a token boundary; <code>a@b.com</code> must
          not.
        </li>
        <li>⇧⏎ six times — the field grows to six lines, then scrolls inside itself.</li>
        <li>Paste an image or drop a file — it becomes a chip, not a path in the draft.</li>
        <li>Type an emoji with a dead key or an IME; the marked composition must survive.</li>
      </ul>
    </div>
  )
}
