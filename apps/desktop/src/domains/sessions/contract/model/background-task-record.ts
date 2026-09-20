export const BACKGROUND_STATES = ['completed', 'failed', 'interrupted'] as const
export type BackgroundState = (typeof BACKGROUND_STATES)[number]

export type BackgroundTaskRecord = {
  kind: 'background-task'
  taskId: string
  callId: string
  outputPath: string | null
  state: BackgroundState
  summary: string | null
  timestamp: string | null
}
