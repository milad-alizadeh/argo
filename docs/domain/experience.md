## Experience

- **Concierge** — the voice interface + its router/brain (ADR-0007, spike-gated, **unbuilt**;
  only the orb *visual* exists). Deferred for v1.
- **Companion plugin** — the bundled plugin that makes a Session `managed` and emits the
  **CONVENTION** tier (ADR-0016). Note: subagent `label`/`group` are **not exclusively
  CONVENTION** — their tier follows their source (CONVENTION when the plugin reports them;
  DERIVED when the CLI's own transcript carries them).
- **Preview** — a **cockpit-level singleton** (at most one across the whole cockpit; starting
  one stops the running one — ADR-0011) that *points at* an Agent. The edge is per-Agent `0..1`
  *attachment*; the running instance is global-single.
- **marked** — the palette's quiet lift: the one ground specified to hold its rise on whatever it
  lands on. It is named for its canonical use, the run of **machine text** it grounds — a `code`
  span mid-sentence, its ink floored by `text.marked(on:)` — and is borrowed by the few other small
  grounds with the same problem: a keycap, a spent send button, the row a `/` menu's cursor is on.
  It names a GROUND and never a state, which is the whole of the rule: a row that is
  **current** (where a keyboard cursor is), **chosen** (the option an ask was answered with) or
  **elided** (a command line cut to fit) is named by its state, and takes this ground or not as a
  separate question. Neighbouring drawn things keep their own words: **marker** (the leading column
  a list row hangs its glyph or number in — `FeedMarker`), **rect** (a rectangle the minimap lane
  draws — `MinimapRect`), **kinded** (a name carrying the glyph for what kind of thing it names —
  `ArgoKindedName`). **mark** stays a general word for a small drawn thing and is read with its
  owner — `FeedMark`, `AccessMark`, `stopMark` — so it is never a shorthand for this ground.
