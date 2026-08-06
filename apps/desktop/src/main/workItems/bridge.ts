import { ipcMain } from 'electron'
import {
  type CommandResult,
  type DeviceCodePrompt,
  WORK_ITEMS_CONNECT_CHANNEL,
  WORK_ITEMS_DEVICE_CODE_CHANNEL,
} from '../../shared'
import { signInWithDeviceFlow } from './github/deviceFlow'
import { type Http, sleep } from './http'
import type { WorkItemSync } from './sync'
import type { TokenStore } from './tokenStore'

// The Electron-coupled seam over the Work Item provider port. One handler, and it does the one
// thing the renderer cannot: run the OAuth device flow and land the token in the OS keychain.
// The code the user must type goes back over its own channel the moment the provider issues
// it, because the invoke does not settle until they have finished with it.

export interface WorkItemsBridgeOptions {
  sync: WorkItemSync
  tokenStore: TokenStore
  http: Http
  /** The OAuth app the device flow authorizes against. Absent means the build was never given
   * one, which refuses the connect instead of opening a flow that cannot complete. */
  clientId: string | undefined
}

export function wireWorkItems(options: WorkItemsBridgeOptions): void {
  ipcMain.handle(WORK_ITEMS_CONNECT_CHANNEL, (event): Promise<CommandResult> => {
    const { clientId } = options
    if (clientId === undefined || clientId === '') {
      return Promise.resolve({ ok: false, detail: 'no GitHub app is configured for this build' })
    }
    return connect(options, clientId, (prompt) =>
      event.sender.send(WORK_ITEMS_DEVICE_CODE_CHANNEL, prompt),
    )
  })
}

async function connect(
  options: WorkItemsBridgeOptions,
  clientId: string,
  onPrompt: (prompt: DeviceCodePrompt) => void,
): Promise<CommandResult> {
  const result = await signInWithDeviceFlow({
    http: options.http,
    clientId,
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
  options.sync.refresh()
  return { ok: true, detail: 'connected' }
}
