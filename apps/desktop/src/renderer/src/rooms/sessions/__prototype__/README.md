# PROTOTYPE — feed navigation (throwaway)

**Question:** how do you navigate up and down a long Activity feed without a second, mirrored
feed beside it — and without the Plan and the Subagents group holding permanent space?

Four variants of the Activity body, on the real plane (real header, real Roster, real Dock, real
feed rows), switchable from a floating bottom bar or `←`/`→`:

| key | name | the move |
|---|---|---|
| A | Density gutter | no nav pane at all; a spatial minimap on the right edge, scrubbable. Plan and subagents inline, where they happened. |
| B | Chapters | the feed IS the nav: turns fold. A sticky chapter bar steps `‹ 5 of 8 ›` and hangs the plan off a pull-down. |
| C | Lens | navigate by REDUCING — a filter pill (all/edits/prose) and a `⌘K` jump palette. Zero permanent chrome. |
| D | Strip | navigation on the OTHER axis — a horizontal timeline above the feed, subagents as forks under it, plan as its fill. |

Story: `Prototype/Feed navigation`. Not production code: no tests, no error handling, throwaway
on merge (see `.claude/skills/prototype/SKILL.md` §6).
