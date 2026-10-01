import { ipcRenderer } from 'electron'
import {
  APPEARANCE_CHANGED_CHANNEL,
  APPEARANCE_READ_CHANNEL,
  APPEARANCE_READY_CHANNEL,
  APPEARANCE_SET_CHANNEL,
  type AppearancePreference,
  type AppearanceState,
  appearanceMutationSchema,
  appearancePreferenceSchema,
  appearanceReadyResultSchema,
  appearanceReadyRevisionSchema,
  appearanceStateSchema,
} from '@/platform/contract/appearance'

let rejectedCount = 0
function validated<Value>(schema: { parse: (value: unknown) => Value }, value: unknown): Value {
  try {
    return schema.parse(value)
  } catch (error) {
    rejectedCount += 1
    console.error(`Rejected appearance bridge value #${rejectedCount}:`, error)
    throw error
  }
}

export const appearanceBridge = {
  async getAppearance() {
    return validated(appearanceStateSchema, await ipcRenderer.invoke(APPEARANCE_READ_CHANNEL))
  },
  async setAppearance(preference: AppearancePreference) {
    const request = validated(appearancePreferenceSchema, preference)
    return validated(
      appearanceMutationSchema,
      await ipcRenderer.invoke(APPEARANCE_SET_CHANNEL, request),
    )
  },
  onAppearanceChanged(listener: (state: AppearanceState) => void) {
    const receive = (_event: Electron.IpcRendererEvent, value: unknown) => {
      let state: AppearanceState
      try {
        state = validated(appearanceStateSchema, value)
      } catch {
        return
      }
      listener(state)
    }
    ipcRenderer.on(APPEARANCE_CHANGED_CHANNEL, receive)
    return () => {
      ipcRenderer.off(APPEARANCE_CHANGED_CHANNEL, receive)
    }
  },
  async appearanceReady(revision: number) {
    const request = validated(appearanceReadyRevisionSchema, revision)
    return validated(
      appearanceReadyResultSchema,
      await ipcRenderer.invoke(APPEARANCE_READY_CHANNEL, request),
    )
  },
}
