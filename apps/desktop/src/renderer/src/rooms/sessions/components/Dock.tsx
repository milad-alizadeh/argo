import {
  CaretDownIcon,
  CaretUpIcon,
  type TerminalAttach,
  TerminalPane,
  TerminalWindowIcon,
  Text,
} from '@/shared/components/ui'
import type { DockModel } from '../interiorDock'
import { NowHead } from './NowHead'

const KIND_LABEL: Record<DockModel['kind'], string> = {
  pty: 'Terminal',
  transcript: 'Transcript',
}

/**
 * Organism: the always-on Dock beneath both tabs — the live PTY, with the now-head in its header
 * row.
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
        <TerminalWindowIcon aria-hidden className="icon-sm text-foreground-faint" />
        <Text variant="meta" className="shrink-0 text-foreground-soft">
          {KIND_LABEL[dock.kind]}
        </Text>
        <Text aria-hidden variant="meta" className="shrink-0 text-foreground-faint">
          ·
        </Text>
        <NowHead now={dock.now} />
        <Caret aria-hidden className="icon-sm shrink-0 text-foreground-faint" />
      </button>
      {dock.kind === 'pty' ? (
        <TerminalPane label="Session terminal" attach={attach} className="flex-1" />
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
