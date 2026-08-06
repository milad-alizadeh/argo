import type { Cli, DeviceCodePrompt } from '@shared'
import type { ConnectPanelHandlers, ConnectRowView } from '@/shell/components'

// The acts the connect panel cannot perform for itself: main owns the folder picker, the
// device-flow sign-in and the registry. The panel names each act and never its mechanism.

/** What is open, and the two setters the acts move it with. */
export interface ConnectSession {
  opened: { mode: 'onboarding' | 'settings'; projectId: string | null; folder: string | null }
  setFolder: (folder: string) => void
  setWelcoming: (welcoming: boolean) => void
  setDevice: (device: DeviceCodePrompt | null) => void
  close: () => void
}

export function connectActs(session: ConnectSession): ConnectPanelHandlers {
  return {
    onContinue: () => session.setWelcoming(false),
    onRowAct: (key) => runRow(session, key),
    onChooseCli: (cli) => chooseCli(session, cli),
    onCommit: () => void commit(session),
    onContinueOffline: session.close,
  }
}

function runRow(session: ConnectSession, key: ConnectRowView['key']): void {
  switch (key) {
    case 'folder':
      return void chooseFolder(session)
    case 'connections':
      return void signIn(session)
    // Argo ships no companion plugin to install yet, so this row offers no act to run and the
    // panel renders no button that would reach here.
    case 'plugin':
      return
  }
}

// A cancelled pick keeps whatever folder was already chosen rather than clearing it: cancelling
// a dialog means "not that one", never "none".
async function chooseFolder(session: ConnectSession): Promise<void> {
  const chosen = await window.cockpit?.chooseProjectFolder()
  if (chosen?.ok === true) session.setFolder(chosen.detail)
}

// The code arrives mid-flight and the promise settles only once GitHub is finished with the
// user, so the panel shows what to type rather than spinning blind. The prompt is cleared
// either way: a sign-in that ended has no code left to enter.
async function signIn(session: ConnectSession): Promise<void> {
  session.setDevice(null)
  await window.cockpit?.connectWorkItems(session.setDevice)
  session.setDevice(null)
}

function chooseCli(session: ConnectSession, cli: Cli): void {
  const { projectId } = session.opened
  if (projectId !== null) void window.cockpit?.setProjectCli(projectId, cli)
}

// `Done` on an existing project is just leaving; `Create project` is the one act onboarding
// exists for. A creation that main refused leaves the panel open with its folder still set,
// because closing over a failure would lose the only thing the user had chosen.
async function commit(session: ConnectSession): Promise<void> {
  const { mode, folder } = session.opened
  if (mode === 'settings' || folder === null) return session.close()
  const created = await window.cockpit?.createProject(folder)
  if (created?.ok === true) session.close()
}
