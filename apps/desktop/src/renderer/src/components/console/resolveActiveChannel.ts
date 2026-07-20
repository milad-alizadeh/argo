import { type ConsoleCapture, LIVE_CHANNEL_ID } from './consoleChannels'

/** Which channel the Console actually shows. The capture slot is owned by the screen, so
 * the selection can name a capture that has since been replaced or cleared (✕) — every
 * such case falls back to live rather than rendering an empty panel. */
export function resolveActiveChannel(activeChannel: string, capture?: ConsoleCapture): string {
  return capture !== undefined && activeChannel === capture.id ? capture.id : LIVE_CHANNEL_ID
}
