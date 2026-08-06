import {
  CaretDownIcon,
  CaretUpIcon,
  type TerminalAttach,
  TerminalPane,
  TerminalWindowIcon,
  Text,
} from '@/shared/components/ui'
import type { DockModel } from '../interior/dock'

const KIND_LABEL: Record<DockModel['kind'], string> = {
  pty: 'Terminal',
  transcript: 'Transcript',
}

// What the Dock's own resting pane says when there is no PTY attached to paint over it. A terminal
// with nothing in it is indistinguishable from a terminal that is broken, and every story plus every
// fresh session lands in exactly that state — so the pane names the three things you can do at it
// rather than going black and reading dead.
const RESTING_PROMPT = '> type to steer · ask a question · ⌘↵ send'

/**
 * Organism: the always-on Dock beneath both tabs — the live PTY, under a header row that names it.
 *
 * **You steer by typing at the prompt and stop with Ctrl-C**, so there is no steer widget and no
 * Stop button: the pane below is a real terminal and takes the keystrokes itself. Expanding grows
 * the pane; it never opens a second surface. An external session has no PTY to attach to, so the
 * Dock says what it is replaying rather than offering a prompt that could steer nothing.
 */
export function Dock({
  dock,
  expanded,
  attach,
  onToggleExpanded,
}: {
  /** The Dock's derived view-model: what kind of surface it is, and the now-head. */
  dock: DockModel
  /** Whether the pane is at its tall height. Derived from the pane's own height by the room, so the
   * caret and the pixels can never disagree. */
  expanded: boolean
  /** Reaches the session's PTY. Absent (an external session, Storybook) leaves the pane inert. */
  attach?: TerminalAttach
  onToggleExpanded?: () => void
}): React.JSX.Element {
  const Caret = expanded ? CaretDownIcon : CaretUpIcon
  return (
    <section
      data-component="Dock"
      aria-label={KIND_LABEL[dock.kind]}
      // Height is the splitter's, carried on the screen-local custom property — the Dock is
      // resizable, so its box is runtime layout state rather than a token step.
      className="flex h-[var(--r-dock)] shrink-0 flex-col overflow-hidden border-t border-t-inset-hair"
    >
      <button
        type="button"
        onClick={onToggleExpanded}
        aria-expanded={expanded}
        className="flex shrink-0 cursor-pointer items-center gap-snug px-plane py-gap text-left outline-none focus-visible:ring-1 focus-visible:ring-ring/60"
      >
        <TerminalWindowIcon aria-hidden className="icon-sm shrink-0 text-foreground-faint" />
        {/* The NAME and nothing else. What stood here was the now-head — the session's state and
            its newest command, which ran to a full line of shell and read as debris on the one row
            whose whole job is to say what this pane is. */}
        <Text variant="meta" className="flex-1 shrink-0 text-foreground-soft">
          {KIND_LABEL[dock.kind]}
        </Text>
        <Caret aria-hidden className="icon-sm shrink-0 text-foreground-faint" />
      </button>
      {dock.kind === 'pty' ? (
        // The pane keeps ONE height whatever the Dock's is, and hangs from the bottom of a box that
        // clips it. Dragging the splitter then reveals more scrollback rather than reflowing the
        // shell: a terminal that resizes rewraps every line it holds, and the prompt you were
        // typing at walks up and down the screen under your cursor. What the drag changes is how
        // much of a fixed-height terminal you can see; where you type never moves.
        <div className="flex min-h-0 flex-1 flex-col justify-end overflow-hidden">
          <TerminalPane
            label="Session terminal"
            attach={attach}
            resting={RESTING_PROMPT}
            className="h-[70vh] shrink-0"
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 items-start px-plane pb-inset">
          <Text variant="code" className="text-foreground-faint">
            read-only — external session, no PTY to steer
          </Text>
        </div>
      )}
    </section>
  )
}
