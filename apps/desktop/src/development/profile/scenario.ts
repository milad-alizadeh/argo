// What every profile scenario provides. A new scenario is one file shaped like this plus one line
// in `scenarios.ts`.
import type { CDPSession, Page } from 'playwright-core'
import type { Coverage } from './frame-recorder'

export type ProfileOptions = {
  runs: number
  // Scroll speed in CSS pixels per second, for the scenarios that scroll.
  speed: number
  // How far each scroll pass travels, capped by what the screen can scroll.
  distance: number
  // Adds a filmstrip to the trace: about a hundred frames a second of JPEGs, so traces grow fast.
  screenshots: boolean
  // How many turns the packaged fixture writes, when no real transcript is given.
  turns: number
  transcript: string | null
  // The Session to open first; the dev target otherwise profiles whatever the window shows.
  session: string | null
}

export type ScenarioRun = { page: Page; cdp: CDPSession; options: ProfileOptions }

export type Scenario = {
  summary: string
  // The area whose uncovered pixels count as blank, and the elements that cover it.
  coverage: Coverage
  // Writes the packaged app's fixture before launch and returns the Session to open.
  seedPackaged: (transcripts: string, options: ProfileOptions) => Promise<string>
  // Opens the screen on one Session: the packaged app starts on none.
  open: (page: Page, sessionId: string) => Promise<void>
  // Puts the screen in its starting state and returns how to put the reader's state back.
  prepare: (run: ScenarioRun) => Promise<() => Promise<void>>
  drive: (run: ScenarioRun) => Promise<void>
}
