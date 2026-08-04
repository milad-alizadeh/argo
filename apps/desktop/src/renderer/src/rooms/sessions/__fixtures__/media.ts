import type { MediaResult, ToolCall } from '@shared'
import { aToolCall } from './runtimeTree'

// The image fixtures the media row and the assembled surfaces share. One home, because the SVG below
// is the only thing in this repo that looks like the screenshot this feature exists to show, and two
// copies of it would be a duplication the build fails on.

/** Which render of the same path a shot is. NAMED rather than a colour, so a caller says what the
 * picture means and the hexes stay inside this file — they are PIXELS in a mock screenshot, not design
 * constants, and nothing outside a fixture should be handed one. */
export const SHOT_STAGES = ['first', 'second', 'third', 'neutral'] as const

export type ShotStage = (typeof SHOT_STAGES)[number]

const STAGE_TINT: Readonly<Record<ShotStage, string>> = {
  first: '#e06c75',
  second: '#e5c07b',
  third: '#98c379',
  neutral: '#61afef',
}

/**
 * A stand-in for the thing a media row is for: a full-window screenshot of a cockpit pane.
 *
 * Drawn as an SVG and base64'd at load rather than shipped as a binary, so the fixture is legible in
 * a diff and a story that renders nothing is a bug in the component rather than a missing asset. The
 * `label` and `stage` are what make three renders of "the same path" visibly three pictures.
 */
export const aShotOf = (label: string, stage: ShotStage = 'neutral'): string =>
  btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="560">
  <rect width="900" height="560" fill="#14161a"/>
  <rect x="0" y="0" width="900" height="34" fill="#1e2127"/>
  <circle cx="20" cy="17" r="5" fill="#e06c75"/><circle cx="38" cy="17" r="5" fill="#e5c07b"/>
  <circle cx="56" cy="17" r="5" fill="#98c379"/>
  <rect x="24" y="70" width="240" height="450" rx="8" fill="#1a1d23"/>
  <rect x="288" y="70" width="588" height="450" rx="8" fill="#1a1d23"/>
  <rect x="312" y="96" width="360" height="16" rx="4" fill="${STAGE_TINT[stage]}"/>
  <rect x="312" y="128" width="520" height="10" rx="3" fill="#2d323b"/>
  <rect x="312" y="150" width="470" height="10" rx="3" fill="#2d323b"/>
  <text x="312" y="230" fill="#8b939f" font-family="monospace" font-size="22">${label}</text>
</svg>`)

/** The embedded tier by default — what the agent actually saw. */
export const aMediaResult = (over: Partial<MediaResult> = {}): MediaResult => ({
  kind: 'media',
  tier: 'direct',
  mediaType: 'image/svg+xml',
  bytes: aShotOf('what the agent saw'),
  ...over,
})

/**
 * Two reads of ONE screenshot path, minutes apart and either side of a paragraph — which is what a
 * visual debugging loop actually looks like.
 *
 * Both are in the interior's fixture on purpose: they are the case that proves the feed shows each
 * read's OWN bytes rather than the newest picture twice under two different paragraphs.
 */
export const theSameShotTwice = (atMs: number): ToolCall[] => [
  aToolCall({
    id: 'c2a',
    name: 'Read',
    target: SHOT_PATH,
    atMs,
    endedAtMs: atMs + 1_000,
    result: aMediaResult({ bytes: aShotOf('before the extraction', 'first') }),
    proseIndex: 1,
  }),
  aToolCall({
    id: 'c2b',
    name: 'Read',
    target: SHOT_PATH,
    atMs: atMs + 2 * 60_000,
    endedAtMs: atMs + 2 * 60_000 + 1_000,
    result: aMediaResult({ bytes: aShotOf('after the extraction', 'third') }),
    proseIndex: 2,
  }),
]

const SHOT_PATH = '/tmp/argo-shots/rotation-before.png'
