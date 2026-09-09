// PROTOTYPE. The one contract every variant implements. What differs between the variants is how
// each of these is honoured, which is the whole question #1754 asks.

import type { KeyIntent } from './keys'

export type CaretRect = { left: number; top: number; bottom: number } | null

export type SurfaceHandle = {
  /** Write the draft and put the caret at an offset — a menu pick, a restored draft, a clear. */
  setValue(text: string, caret: number): void
  focus(): void
}

export type SurfaceProps = {
  draft: string
  placeholder: string
  /** Whether a `/` at the draft's head is a command the CLI will run. */
  canRunCommands: boolean
  onChange(text: string, caret: number): void
  /** True where the host consumed the key — the surface must then do nothing with it. */
  onIntent(intent: KeyIntent): boolean
  /** Where the caret is on screen, so the host can stand a menu against it. */
  onCaretRect(rect: CaretRect): void
  /** A paste holding files or pixels rather than words becomes an attachment (#540). */
  onAttach(names: string[]): void
}

/** What each variant reports about itself, shown in the readout beside the composer. */
export type VariantNote = {
  key: string
  name: string
  /** The runtime dependency it adds, or null for none. */
  dependency: string | null
  /** What had to be written by hand for this surface to carry the composer's behaviour. */
  handWork: string[]
  /** What the surface gets for free. */
  free: string[]
  /** What it cannot do, or does badly. */
  costs: string[]
}
