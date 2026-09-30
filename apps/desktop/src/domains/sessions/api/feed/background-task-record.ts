export const BACKGROUND_STATES = ['completed', 'failed', 'interrupted'] as const
export type BackgroundState = (typeof BACKGROUND_STATES)[number]
