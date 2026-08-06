import { ipcMain } from 'electron'
import {
  type CommandResult,
  type DeviceCodePrompt,
  WORK_ITEMS_CONNECT_CHANNEL,
  WORK_ITEMS_DEVICE_CODE_CHANNEL,
} from '../../shared'
import type { Hub } from '../hub'
import { githubClientId, signInWithDeviceFlow } from './github/deviceFlow'
import { type Http, sleep } from './http'
import type { WorkItemSync } from './sync'
import type { TokenStore } from './tokenStore'

// The Electron-coupled seam over the Work Item provider port. One handler, and it does the one
// thing the renderer cannot: run the OAuth device flow and land the token in the OS keychain.
// The code the user must type goes back over its own channel the moment the provider issues
// it, because the invoke does not settle until they have finished with it.

export interface WorkItemsBridgeOptions {
  hub: Hub
  sync: WorkItemSync
  tokenStore: TokenStore
  http: Http
}

export function wireWorkItems(options: WorkItemsBridgeOptions): void {
  ipcMain.handle(
    WORK_ITEMS_CONNECT_CHANNEL,
    (event): Promise<CommandResult> =>
      connect(options, (prompt) => event.sender.send(WORK_ITEMS_DEVICE_CODE_CHANNEL, prompt)),
  )
}

async function connect(
  options: WorkItemsBridgeOptions,
  onPrompt: (prompt: DeviceCodePrompt) => void,
): Promise<CommandResult> {
  const result = await signInWithDeviceFlow({
    http: options.http,
    clientId: githubClientId(process.env),
    onCode: (code) =>
      onPrompt({
        userCode: code.userCode,
        verificationUri: code.verificationUri,
        expiresIn: code.expiresIn,
      }),
    wait: sleep,
  })
  if (!result.ok) return { ok: false, detail: result.detail }

  // A token that cannot be stored is not a connection: this machine has no keychain backend,
  // and holding it in memory would make the next launch silently disconnected.
  if (!(await options.tokenStore.write(result.token))) {
    return { ok: false, detail: 'this machine has no keychain to store the token in' }
  }
  // DIRECT: Argo ran this grant and stored its token, so the panel does not wait a poll
  // interval to learn what just happened — and a `needs-reconnect` this sign-in was the answer
  // to stands down here rather than on the next successful read.
  options.hub.apply({ type: 'grant-changed', grant: 'connected' })
  options.sync.refresh()
  return { ok: true, detail: 'connected' }
}
