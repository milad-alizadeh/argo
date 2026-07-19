import type { ElectronAPI } from '@electron-toolkit/preload'
import type { CockpitBridge } from '../shared'

declare global {
  interface Window {
    electron: ElectronAPI
    cockpit: CockpitBridge
  }
}
