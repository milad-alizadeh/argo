import type { DeviceCodePrompt } from '@shared'
import {
  buildConnectPanelModel,
  type ConnectPanelInput,
  type ConnectPanelModel,
  type ConnectState,
} from '../connectPanelModel'

// One home for the panel's inputs, shared by its suite and its stories. The two would otherwise
// each keep a copy of the same seven-field default, and a field added to the model would leave
// the stories rendering a shape the tests had already moved past.

export const FIXTURE_FOLDER = '/Users/dev/code/argo'

export const FIXTURE_DEVICE: DeviceCodePrompt = {
  userCode: 'WDJB-MJHT',
  verificationUri: 'https://github.com/login/device',
  expiresIn: 900,
}

/** The panel from just the facts a case is about. Defaults are the honest floor: onboarding, past
 * Welcome, nothing chosen and nothing connected. */
export const connectPanel = (over: Partial<ConnectPanelInput> = {}): ConnectPanelModel =>
  buildConnectPanelModel({
    mode: 'onboarding',
    welcoming: false,
    folder: null,
    grant: 'none',
    plugin: 'unavailable',
    device: null,
    cli: null,
    ...over,
  })

/** What puts the panel in each of its seven states, so the gallery and the state table read from
 * one list rather than two that can disagree. */
export const CONNECT_INPUT_BY_STATE: Record<ConnectState, Partial<ConnectPanelInput>> = {
  welcome: { welcoming: true },
  fresh: {},
  direct: { folder: FIXTURE_FOLDER },
  connecting: { folder: FIXTURE_FOLDER, device: FIXTURE_DEVICE },
  partial: { folder: FIXTURE_FOLDER, grant: 'connected' },
  wired: { folder: FIXTURE_FOLDER, grant: 'connected', plugin: 'installed' },
  error: { folder: FIXTURE_FOLDER, grant: 'needs-reconnect' },
}
