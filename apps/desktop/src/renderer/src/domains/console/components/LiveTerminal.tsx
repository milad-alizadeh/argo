import '@xterm/xterm/css/xterm.css'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { LIVE_CHANNEL_LABEL } from './consoleChannels'

type LiveTerminalProps = {
  /** DOM id, so the `session · live` tab can point at this panel. */
  id?: string
  className?: string
}

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

// Container: the session's live channel as a REAL xterm terminal — R13's ONE monospace
// surface, now an actual shell rather than a static tail. The View around it (Console) stays
// props-in → JSX-out; the wiring to main's PTY lives here, behind `window.cockpit`.
//
// The terminal paints NO background of its own: it sits directly on the panel's single frosted
// surface (no glass on glass), so `allowTransparency` + a transparent theme let the panel read
// through. The xterm layers are forced transparent in `globals.css` under `.live-terminal`.
export function LiveTerminal({ id, className }: LiveTerminalProps): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

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

    const bridge = window.cockpit
    if (bridge?.openTerminal) {
      const session = bridge.openTerminal({ cols: term.cols, rows: term.rows }, (chunk) =>
        term.write(chunk),
      )
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
    }

    // No bridge (Storybook / a plain browser preview): there is no PTY to attach to. Say so
    // plainly — do NOT paint a fake prompt, or the preview reads as a mock. The real shell only
    // appears when the app runs. The surface + its transparency over the panel stay reviewable.
    term.writeln('\x1b[2m│ live shell — attaches to a real PTY when the app runs\x1b[0m')
    term.write('\x1b[2m│ (no terminal in Storybook)\x1b[0m')
    const observer = new ResizeObserver(() => fit.fit())
    observer.observe(host)
    return () => {
      observer.disconnect()
      term.dispose()
    }
  }, [])

  return (
    <div
      ref={hostRef}
      id={id}
      role="tabpanel"
      aria-label={LIVE_CHANNEL_LABEL}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: a tabpanel is focusable by design, so the shell takes keystrokes and the console's Esc handler hears them.
      tabIndex={0}
      // A live shell (blinking cursor, changing output) is non-deterministic — mask it from the
      // visual-diff so the strip around it is what the baseline gates on.
      data-vrt-mask
      className={cn(
        'live-terminal min-h-0 overflow-hidden px-inset py-gap font-mono text-code text-foreground-soft outline-none',
        className,
      )}
    />
  )
}
