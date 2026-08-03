import os from 'node:os'
import { ipcMain, type WebContents } from 'electron'
import { type IPty, spawn } from 'node-pty'
import {
  TERMINAL_ATTACH_CHANNEL,
  TERMINAL_DATA_CHANNEL,
  TERMINAL_INPUT_CHANNEL,
  TERMINAL_RESIZE_CHANNEL,
  type TerminalAttachRequest,
  type TerminalSize,
} from '../shared'
import type { Hub } from './hub'

// The login shell to steer. The user's own `$SHELL` on macOS/Linux; COMSPEC (or PowerShell)
// on Windows — the PTY is the session's real terminal, not a canned one.
function shellCommand(): string {
  if (process.platform === 'win32') return process.env.COMSPEC ?? 'powershell.exe'
  return process.env.SHELL ?? '/bin/bash'
}

// One shell PER SESSION per window. Keyed by WebContents alone, every session in a window shared one
// shell, so opening a second session's Dock showed the first's — the session id is part of the key
// because that is the granularity the Dock renders at.
const shellKey = (target: WebContents, sessionId: string): string => `${target.id}:${sessionId}`

// The session's own working directory, so its shell opens where its work is. Falls back to the home
// directory for a session whose cwd Argo never observed.
function sessionCwd(hub: Hub, sessionId: string): string {
  const session = hub.getState().sessions.find((candidate) => candidate.id === sessionId)
  return session?.cwd ?? os.homedir()
}

/**
 * The steering PTY transport — ADR-0005's companion to the projection bridge.
 *
 * A renderer attaches with the session it is attaching for; main spawns that session's shell and
 * pipes its output back tagged with the same id, and keystrokes and resizes flow the other way. A
 * shell is killed when its window goes away, when it exits on its own, or when the same session
 * re-attaches (dev HMR reload).
 */
export function wireTerminal(hub: Hub): void {
  const shells = new Map<string, { shell: IPty; target: WebContents }>()

  const dispose = (key: string): void => {
    const entry = shells.get(key)
    if (entry === undefined) return
    entry.shell.kill()
    shells.delete(key)
  }

  ipcMain.on(TERMINAL_ATTACH_CHANNEL, (event, { sessionId, size }: TerminalAttachRequest) => {
    const target = event.sender
    const key = shellKey(target, sessionId)

    // A reload re-attaches the same session; kill the stale shell first so a detached PTY isn't
    // left running.
    dispose(key)

    const shell = spawn(shellCommand(), [], {
      name: 'xterm-color',
      // A viewport that has not laid out yet reports 0 cells; fall back so the PTY never spawns
      // at an invalid size (it is resized the moment the fit runs).
      cols: size.cols || 80,
      rows: size.rows || 24,
      cwd: sessionCwd(hub, sessionId),
      env: process.env as Record<string, string>,
    })
    shells.set(key, { shell, target })

    // Tagged with the session, so a window holding several Docks routes each shell to its own pane.
    shell.onData((chunk) => {
      if (!target.isDestroyed()) target.send(TERMINAL_DATA_CHANNEL, chunk, sessionId)
    })

    // Only clear the entry if it still points at THIS shell: on a re-attach the old shell's `onExit`
    // fires after the new one is `set()`, and an unguarded delete would drop the new shell's entry —
    // silently breaking its input/resize and leaking the PTY.
    shell.onExit(() => {
      if (shells.get(key)?.shell === shell) dispose(key)
    })
    target.once('destroyed', () => {
      for (const [live, entry] of [...shells]) if (entry.target === target) dispose(live)
    })
  })

  ipcMain.on(TERMINAL_INPUT_CHANNEL, (event, message: { sessionId: string; data: string }) => {
    shells.get(shellKey(event.sender, message.sessionId))?.shell.write(message.data)
  })

  ipcMain.on(
    TERMINAL_RESIZE_CHANNEL,
    (event, { sessionId, size }: { sessionId: string; size: TerminalSize }) => {
      // resize throws if the shell exited between the renderer's observe and this message; the
      // next attach makes a fresh one, so there is nothing to do here.
      try {
        shells.get(shellKey(event.sender, sessionId))?.shell.resize(size.cols, size.rows)
      } catch {
        // shell is gone
      }
    },
  )
}
