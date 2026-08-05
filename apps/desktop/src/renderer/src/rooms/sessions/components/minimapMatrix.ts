// ONE table for what a row IS — its ink in the feed and its mark on the density strip — because
// they are one question asked twice and were being answered twice.
//
// The strip and the feed each had their own palette before this. So the map beside the column was
// decoding a legend the column never taught, and there was nothing to learn it FROM: a teal tick had
// no teal anything next to it. Now the feed's glyph and verb wear exactly the tone the strip paints,
// so the strip is legible for the same reason a chart with a legend is — the legend is the feed.
//
// TWO axes, each answering one question:
//
//   HUE   — what kind of thing this was. Shared by both surfaces, which is the whole point.
//   WIDTH — how much it is worth your attention. The strip's alone; the feed spends no width on it.
//
// Width does the strip's real work. Things that happened TO you — you asked, your code changed, the
// agent looked at a picture, the plan moved — run the full track. The agent's own routine work stops
// short: message, then call, then thought and the folded quiet reads. Read down the RIGHT edge the
// strip becomes a profile of consequence, and a dense stretch of tool work is visibly dense rather
// than visibly empty.
//
// LEFT-ANCHORED, every mark, which is what makes that profile legible beside the column it maps: the
// feed is a left-aligned list with a ragged right edge, so a strip whose short marks hung off the
// RIGHT edge was a mirror image of the thing it was describing — the eye had to flip it to read it.
//
// FAILURE overrides the hue and takes the full track whatever kind it happened to. A failed edit
// that paints like a successful one is the most expensive thing this map can get wrong.

/** One kind's mark: the tone the STRIP paints, the tone the FEED's glyph and verb wear, and how far
 * across the track the mark reaches. */
export interface MinimapMark {
  tone: string
  /** The feed's ink for the same kind — the same hue, at text contrast rather than fill contrast. */
  ink: string
  /** How far across the track the mark stops, as a Tailwind inset from the RIGHT. Full-width marks
   * have none. */
  inset: string
}

/** Full width — no inset at all. The rung for anything that happened to YOU. */
const FULL = ''

const MARKS: Readonly<Record<string, MinimapMark>> = {
  // Gold, because the sticky seam that heads every turn is gold: the one mark you can name on sight
  // is where an exchange began.
  prompt: { tone: 'bg-primary', ink: 'text-primary', inset: FULL },
  // Teal, because that is what a diff's added lines wear. Your code changed — the loudest thing on
  // the surface and the reason a session is worth watching at all.
  mutation: { tone: 'bg-tone-run', ink: 'text-tone-run', inset: FULL },
  // The brightest neutral: a screenshot is the one thing a terminal cannot show, so it is the one
  // thing worth spotting in a strip you are scrubbing rather than reading.
  media: { tone: 'bg-foreground/85', ink: 'text-foreground', inset: FULL },
  // Amber, matching the plan's own chrome. Full width because a revised plan is a change of intent,
  // not a step of work.
  plan: { tone: 'bg-tone-amber/70', ink: 'text-tone-amber', inset: FULL },
  // The agent spoke. The widest of the short marks: prose is what you go back to read, and in the
  // feed it is the row the eye should land on — so this is the one row that reads at full strength.
  message: { tone: 'bg-foreground/55', ink: 'text-foreground', inset: 'right-[30%]' },
  // The agent ran something. Present, narrower — a command matters, but a hundred of them are a
  // texture rather than a hundred events.
  call: { tone: 'bg-foreground/32', ink: 'text-foreground-soft', inset: 'right-[55%]' },
  // The agent reasoned. Narrower still: it is what you consult when a conclusion surprises you.
  thought: { tone: 'bg-foreground/22', ink: 'text-foreground-faint', inset: 'right-[72%]' },
  // The folded routine reads. The faintest mark that is still a mark — it says work happened here
  // without asking you to care which.
  quiet: { tone: 'bg-foreground/18', ink: 'text-foreground-faint', inset: 'right-[72%]' },
  // History was condensed. Full width because it is a seam in the record itself, and its own
  // near-zero height keeps it a hairline rather than a band.
  compaction: { tone: 'bg-foreground/40', ink: 'text-foreground-faint', inset: FULL },
}

/** A break, whatever kind of row it happened to. Overrides the hue and takes the full track: the
 * strip's job here is to be findable while you scrub, not to preserve what kind of call broke — the
 * row itself says that, and you are one click from it. */
const FAILED: MinimapMark = { tone: 'bg-signal-bad', ink: 'text-tone-red', inset: FULL }

/** An unrecognised kind. Mid-scale rather than invisible or loud: a row Argo has no mark for is
 * still a row that happened, and guessing it into a full-width tone would overstate it. */
const UNKNOWN: MinimapMark = {
  tone: 'bg-foreground/30',
  ink: 'text-foreground-soft',
  inset: 'right-[55%]',
}

export const markFor = (kind: string, failed: boolean): MinimapMark =>
  failed ? FAILED : (MARKS[kind] ?? UNKNOWN)

/** The feed's ink for one row kind — the same lookup the strip makes, so the two can never drift. */
export const inkFor = (kind: string, failed = false): string => markFor(kind, failed).ink
