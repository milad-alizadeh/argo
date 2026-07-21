import os from 'node:os'
import { ipcMain, type WebContents } from 'electron'
import { type IPty, spawn } from 'node-pty'
import {
  TERMINAL_ATTACH_CHANNEL,
  TERMINAL_DATA_CHANNEL,
  TERMINAL_INPUT_CHANNEL,
  TERMINAL_RESIZE_CHANNEL,
  type TerminalSize,
} from '../shared'

// The login shell to steer. The user's own `$SHELL` on macOS/Linux; COMSPEC (or PowerShell)
// on Windows — the PTY is the session's real terminal, not a canned one.
function shellCommand(): string {
  if (process.platform === 'win32') return process.env.COMSPEC ?? 'powershell.exe'
  return process.env.SHELL ?? '/bin/bash'
}

// The steering PTY transport — ADR-0005's companion to the projection bridge. One shell per
// window: a renderer attaches with its viewport size, main spawns the PTY and pipes its output
// back over IPC; keystrokes and resizes flow the other way. The shell is killed when its window
// goes away, when it exits on its own, or when the renderer re-attaches (dev HMR reload).
export function wireTerminal(): void {
  const shells = new WeakMap<WebContents, IPty>()

  ipcMain.on(TERMINAL_ATTACH_CHANNEL, (event, size: TerminalSize) => {
    const target = event.sender

    // A reload re-attaches on the same WebContents; kill the stale shell first so a detached
    // PTY isn't left running.
    shells.get(target)?.kill()

    const shell = spawn(shellCommand(), [], {
      name: 'xterm-color',
      // A viewport that has not laid out yet reports 0 cells; fall back so the PTY never spawns
      // at an invalid size (it is resized the moment the fit runs).
      cols: size.cols || 80,
      rows: size.rows || 24,
      cwd: os.homedir(),
      env: process.env as Record<string, string>,
    })
    shells.set(target, shell)

    shell.onData((chunk) => {
      if (!target.isDestroyed()) target.send(TERMINAL_DATA_CHANNEL, chunk)
    })

    const dispose = (): void => {
      shell.kill()
      // Only clear the map if it still points at THIS shell: on a re-attach the old shell's
      // `onExit` fires after the new one is `set()`, and an unguarded delete would drop the new
      // shell's entry — silently breaking its input/resize and leaking the PTY.
      if (shells.get(target) === shell) shells.delete(target)
    }
    shell.onExit(dispose)
    target.once('destroyed', dispose)
  })

  ipcMain.on(TERMINAL_INPUT_CHANNEL, (event, data: string) => {
    shells.get(event.sender)?.write(data)
  })

  ipcMain.on(TERMINAL_RESIZE_CHANNEL, (event, size: TerminalSize) => {
    // resize throws if the shell exited between the renderer's observe and this message; the
    // next attach makes a fresh one, so there is nothing to do here.
    try {
      shells.get(event.sender)?.resize(size.cols, size.rows)
    } catch {
      // shell is gone
    }
  })
}
