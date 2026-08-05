import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Text } from '@/shared/components/ui'
import { type JumpTarget, matching } from './lenses'

// PROTOTYPE — variant C's index, and the point is WHEN it exists: only while you are asking for it.
// An index summoned by `⌘K` costs nothing when you are reading, and can be richer than a standing
// pane could afford — turns, delegates and touched files in one list, filtered by typing.

const KIND_TONE: Record<JumpTarget['kind'], string> = {
  turn: 'text-foreground',
  subagent: 'text-primary',
  file: 'text-tone-run',
}

function Row({
  target,
  selected,
  onPick,
}: {
  target: JumpTarget
  selected: boolean
  onPick: () => void
}): React.JSX.Element {
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        className={cn(
          'flex w-full cursor-pointer items-baseline gap-snug rounded-md px-gap py-tight text-left',
          selected && 'bg-primary/10 ring-1 ring-inset ring-primary/20',
        )}
      >
        <Text variant="tag" className={cn('w-[9ch] shrink-0', KIND_TONE[target.kind])}>
          {target.kind}
        </Text>
        <Text variant="row" className="min-w-0 flex-1 truncate text-foreground-soft">
          {target.label}
        </Text>
        <Text variant="tag" className="shrink-0 text-foreground-faint">
          {target.hint}
        </Text>
      </button>
    </li>
  )
}

/** `⌘K`, wired at the window so the palette opens wherever the reader's focus is. */
export function usePaletteKey(onOpen: () => void): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        onOpen()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onOpen])
}

/** The summoned index: type to filter, `↑`/`↓` to move, `enter` to jump, `esc` to leave. */
export function JumpPalette({
  targets,
  onPick,
  onClose,
}: {
  targets: readonly JumpTarget[]
  onPick: (key: string) => void
  onClose: () => void
}): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [at, setAt] = useState(0)
  const shown = matching(targets, query)
  const picked = shown[Math.min(at, shown.length - 1)]

  return (
    <div className="absolute inset-0 z-20 flex items-start justify-center pt-[12vh]">
      {/* The scrim is a BUTTON, not a div with a click handler: clicking away is a real action and
          wants a real control, which is also the only way it takes a key. */}
      <button
        type="button"
        aria-label="Close the jump palette"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-background/60 backdrop-blur-sm"
      />
      <div className="z-10 flex max-h-[60vh] w-[60ch] flex-col gap-inset rounded-xl bg-popover p-inset shadow-2xl ring-1 ring-inset-hair">
        <input
          // biome-ignore lint/a11y/noAutofocus: a summoned palette that does not take the caret is a palette you have to click into.
          autoFocus
          value={query}
          placeholder="jump to a turn, a subagent, a file…"
          onChange={(event) => {
            setQuery(event.target.value)
            setAt(0)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') onClose()
            if (event.key === 'ArrowDown') setAt((index) => Math.min(shown.length - 1, index + 1))
            if (event.key === 'ArrowUp') setAt((index) => Math.max(0, index - 1))
            if (event.key === 'Enter' && picked) {
              onPick(picked.key)
              onClose()
            }
          }}
          className="w-full bg-transparent px-gap py-snug text-prose text-foreground outline-none placeholder:text-foreground-faint"
        />
        <ul className="flex min-h-0 flex-col overflow-y-auto border-t border-t-inset-hair pt-tight">
          {shown.map((target) => (
            <Row
              key={target.id}
              target={target}
              selected={target === picked}
              onPick={() => {
                onPick(target.key)
                onClose()
              }}
            />
          ))}
        </ul>
      </div>
    </div>
  )
}
