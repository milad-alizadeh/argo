import '@xterm/xterm/css/xterm.css'
import type { TerminalSession, TerminalSize } from '@shared'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { Terminal } from '@xterm/xterm'
import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

/** How the pane reaches a PTY — the bridge's own `openTerminal` shape. Passed in rather than read
 * here, because a primitive must not know the bridge: the composition root's wiring owns that
 * (`cockpit/`), which is what keeps this pane a View. */
export type TerminalAttach = (
  size: TerminalSize,
  onChunk: (chunk: string) => void,
) => TerminalSession

// Resolve a CSS colour expression (a `var(--token)`, possibly a `color-mix()`) to a concrete
// colour xterm's parser accepts. getComputedStyle on a real `color` property does the resolving;
// modern Chrome hands back `color(srgb r g b / a)`, which xterm can't read, so normalise it to
// rgba(). A probe in the host inherits the same custom-property scope the terminal sits in.
function resolveColor(host: HTMLElement, expr: string): string {
  const probe = document.createElement('span')
  probe.style.color = expr
  probe.style.display = 'none'
  host.appendChild(probe)
  const computed = getComputedStyle(probe).color
  probe.remove()
  const srgb = computed.match(/srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?/)
  if (srgb === null) return computed
  const [r, g, b] = [srgb[1], srgb[2], srgb[3]].map((v) => Math.round(Number(v) * 255))
  return `rgba(${r}, ${g}, ${b}, ${srgb[4] ?? '1'})`
}

// The values xterm can't take from CSS: it paints its own DOM, so the token font and colours
// are read off the host's computed style rather than inherited. Background is deliberately not
// here — the theme sets it transparent so the panel glass reads through, and the selection is the
// `--terminal-selection` wash rather than the default solid block.
function terminalTheme(host: HTMLElement): {
  fontFamily: string
  fontSize: number
  foreground: string
  selection: string
} {
  const style = getComputedStyle(host)
  return {
    fontFamily: style.fontFamily || 'monospace',
    fontSize: Number.parseFloat(style.fontSize) || 12,
    foreground: style.color,
    selection: resolveColor(host, 'var(--terminal-selection)'),
  }
}

function openTerminal(host: HTMLElement): { term: Terminal; fit: FitAddon } {
  const { fontFamily, fontSize, foreground, selection } = terminalTheme(host)
  const term = new Terminal({
    allowTransparency: true,
    cursorBlink: true,
    fontFamily,
    fontSize,
    lineHeight: 1.3,
    theme: {
      background: 'rgba(0, 0, 0, 0)',
      foreground,
      cursor: foreground,
      selectionBackground: selection,
      selectionInactiveBackground: selection,
    },
  })
  const fit = new FitAddon()
  term.loadAddon(fit)
  term.open(host)
  fit.fit()

  // GPU glyph rendering (the Warp/Ghostty trick) instead of xterm's default DOM renderer, so a
  // terminal blasting output stays smooth. `term.open` must run first — WebGL binds to the live
  // canvas. If the GPU context is lost (driver hiccup, too many live contexts once there are
  // many panes) we dispose the addon; xterm silently reverts to the DOM renderer, so the shell
  // keeps working. Construction is guarded because xterm 6's renderer internals are newer than
  // this addon's stable line — a throw must degrade to DOM, never break the pane.
  try {
    const webgl = new WebglAddon()
    webgl.onContextLoss(() => webgl.dispose())
    term.loadAddon(webgl)
  } catch {
    // WebGL unavailable — xterm's DOM renderer stays in place.
  }
  return { term, fit }
}

/**
 * Organism: a real terminal surface — the ONE monospace pane, shared by a session's Dock and the
 * Code room's scratch terminal.
 *
 * The pane paints NO background of its own: it sits directly on the surrounding frosted surface (no
 * glass on glass), so `allowTransparency` plus a transparent theme let the panel read through. With
 * no `attach` there is no PTY, and the pane says so plainly rather than painting a fake prompt — a
 * mocked shell in a preview reads as a real one.
 */
export function TerminalPane({
  label,
  attach,
  resting = '│ live shell — attaches to a real PTY when the app runs',
  className,
}: {
  /** What this terminal is, for assistive tech — the surface has no visible heading of its own. */
  label: string
  /** Reaches a live PTY. Absent (Storybook, a plain browser preview) leaves the pane inert. */
  attach?: TerminalAttach
  /** The ONE line the pane rests on while no PTY is attached. The caller owns the words because
   * only it knows what typing here would do — a Dock says what you can steer, a preview says it is
   * a preview. Written into the terminal itself rather than laid over it, so an attached PTY's
   * first frame is the only thing that can be on screen. */
  resting?: string
  className?: string
}): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const { term, fit } = openTerminal(host)

    if (!attach) {
      term.write(`\x1b[2m${resting}\x1b[0m`)
      const idle = new ResizeObserver(() => fit.fit())
      idle.observe(host)
      return () => {
        idle.disconnect()
        term.dispose()
      }
    }

    const session = attach({ cols: term.cols, rows: term.rows }, (chunk) => term.write(chunk))
    const input = term.onData((data) => session.write(data))
    const observer = new ResizeObserver(() => {
      fit.fit()
      session.resize({ cols: term.cols, rows: term.rows })
    })
    observer.observe(host)
    return () => {
      observer.disconnect()
      input.dispose()
      session.dispose()
      term.dispose()
    }
  }, [attach, resting])

  return (
    <section
      ref={hostRef}
      aria-label={label}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: the pane is focusable by design, so the shell takes keystrokes — you steer a session by typing here.
      tabIndex={0}
      className={cn(
        'live-terminal min-h-0 overflow-hidden px-inset py-gap font-mono text-code text-foreground-soft outline-none',
        className,
      )}
    />
  )
}
