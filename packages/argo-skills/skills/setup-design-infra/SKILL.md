---
name: setup-design-infra
description: Install a project's design→code machinery — token contract, docs/designs/ scaffolding, no-raw-values check, render method, and the stack.md every later design skill reads instead of hardcoding a framework.
disable-model-invocation: true
---

# Setup Design Infra

Make the design→code handoff survivable in *this* project. The system rests on one
idea: **the contract is a set of named design decisions** (tokens + component
names). Designs, apps, and every framework rendering of them speak only in those
names.

This skill installs the five mechanical pieces that hold the contract — the token
layer, the `docs/designs/` scaffolding, the no-raw-values check, the render method,
and the `stack.md` that makes the other skills framework-agnostic. The *prose* rules
(`design-system.md`, `designs.md`, `ui-components.md`) come from `setup-rules`
— run that first if the repo has no `rules/` yet. The token *values* come from
`setup-design-foundations` — run that next.

**Golden rule: adapt, don't dump.** Every path, glob, and command installed must
resolve to something real in this repo.

## 1. Detect the target stack

Look before asking: `tailwindcss` in package.json? `tamagui` / `react-native`? A
`Package.swift` with a UI module? Both web and native (a monorepo)? Confirm with the
user, then pick the token-layer shape:

| Stack | Token contract | Wiring |
|---|---|---|
| Web + Tailwind | one CSS custom-property file (`:root` + theme variants) | `@theme inline` block maps vars → utilities |
| React Native / Tamagui | `tokens.ts` feeding `createTokens()` | Tamagui config imports it |
| Native (Swift / Kotlin) | a constants source in the UI module (e.g. `VisualContract/`) | consumed directly by views |
| Multi-platform | DTCG `tokens.json` (W3C design-tokens format) | Style Dictionary build → per-target outputs |

For multi-platform, **look up the current Style Dictionary docs online before
wiring** — don't hand-author config from memory. The JSON is then the only
hand-edited file; the CSS/TS outputs are generated and never edited.

## 2. Install or complete the token contract

If a token layer already exists, **extend, never replace**. The contract must cover
all four families before the handoff works; most projects that "have tokens" have
only colors:

1. **Color roles** — semantic (`background`, `foreground`, `muted`, `border`, status
   roles), themed per variant (light/dark).
2. **Typography roles** — a small fixed ramp (micro / label / body / body-lg / title
   / display), each a **full tuple**: size + line-height + weight + letter-spacing.
   Named by role, never by value.
3. **Spacing roles** — the rhythm steps the design actually uses.
4. **Radii / durations / opacity** as used.

This skill installs the *structure*; the values are design work. When families are
missing, run `setup-design-foundations` next — the moodboard→contract ceremony that
designs the ramps deliberately and lands them only behind a user bless. Never derive
a scale inline here.

## 3. Install the design scaffolding

- Create `docs/designs/` + a `README.md` index (per the `designs` rule).
- Install `docs/designs/tokens.css` — the **browser mirror** of the contract, so a
  design in a browser speaks the app's real vocabulary.

  When the contract is already CSS, mirror it. When it is **not** — a Swift
  `VisualContract`, a Kotlin theme, a DTCG source — this is an **export step**:
  a small generator (or a Style Dictionary target) writes the mirror from the
  contract. Wire the generator into the same command that builds the app or runs
  quality, so the mirror cannot silently fall behind. **A hand-copied mirror is the
  bug this step exists to prevent** — it is the one place where a native project
  quietly stops being framework-agnostic.
- Seed a `design-template.html` that imports `tokens.css`, styles only via
  `var(--token)`, and shows the `data-component="PascalCaseName"` region-naming
  convention inline as a worked example.
- If the repo ignores docs in a knowledge graph (`.graphifyignore`), confirm
  `docs/designs/` is covered.

## 4. Install the no-raw-values check

Copy `templates/check-design-tokens.sh` (next to this SKILL.md), substitute its
placeholders, and make it executable:

| Placeholder | Meaning | Example |
|---|---|---|
| `{{SRC_DIRS}}` | space-separated dirs to scan | `apps/web/src/components` |
| `{{EXCLUDE_FILES}}` | token/theme files where raw values are legal | `tokens.css globals.css` |

- Add a root script: `"check:design-tokens": "sh scripts/check-design-tokens.sh"`.
- Wire it into CI (append a step to an existing lint/boundaries workflow rather than
  adding a new one, when possible) and into the pre-commit hook if the repo has one.
- **For React Native targets**, adapt the patterns at install time: quoted hex
  literals and numeric `fontSize:`/`padding:` style-object literals instead of
  Tailwind arbitrary values. **For native targets**, the equivalent is a literal
  colour/size in a view file. Keep the same allowlist mechanism.
- Run it once. If the existing codebase fails, seed the allowlist with the current
  offenders **and file one debt ticket** listing them — the check must be green on
  install, and the debt visible, or it gets disabled within a week.

## 5. Install the render method

`pixel-review` and `design-to-code` both need to render one UI state deterministically.
What varies per project is *how*. Detect it — recommend, don't present a blank menu:

- `.storybook/` present → **Storybook** (best: stories enumerate states).
- A native app with an isolated-state harness (a specimen catalog, a preview target)
  → **that harness**, launched by state name.
- `docs/designs/` populated → **the designs themselves**, screenshotted via `file://`.
- A `dev`/`start` script serving UI → **dev server**.
- Several present → the app's own harness for built screens, the designs for unbuilt
  ones; say so.

Then install the mechanics:

- **Browser targets** — copy `templates/screenshot-states.mjs` to
  `scripts/screenshot-states.mjs`. It needs Playwright: use the project's existing
  `playwright` devDependency if there is one; otherwise note that `pixel-review` will
  run it via `npx playwright`.
- **Native targets** — there is no generic script. Record the project's own capture
  command in `stack.md` instead, and confirm it captures the **window**, not the
  screen.

Confirm anything non-obvious with the user: custom ports, auth walls, build steps,
OS permissions the first capture will prompt for.

### Optional — pixel-diff regression tests

A distinct layer, separate opt-in: committed screenshot baselines with a CI gate, so
blessed UI can't drift silently. Offer it only when the project has an
enumerable-state harness **and** CI; if accepted, generate baselines in **one**
environment only (CI or a container — cross-OS font rendering false-positives
otherwise), animations disabled, dynamic regions masked.

## 6. Write `stack.md` — the file that makes the other skills portable

`docs/designs/stack.md`. Five questions, answered for this repo, and nothing else.
Every later design skill reads it instead of hardcoding a framework — this file is
the reason `design-to-code` does not have to say "Storybook".

```markdown
# Design stack

- **Token contract** — <path>. The only place raw values live.
- **Browser mirror** — docs/designs/tokens.css, generated by <command>.
- **Components live in** — <path(s)>, and the rule for choosing between them.
- **Isolated-state mechanism** — <stories | specimen catalog | preview target>,
  added by <what a new state costs>.
- **Render a state** — <command>, output <where>.
```

Keep it to those five. A stack file that grows prose is one nobody re-reads.

Also append a short **Visual verification** section to the project's `AGENTS.md`
pointing at `stack.md`, so an agent that never runs this wizard still finds the
render method.

## 7. Verify and report

- A deliberately-bad line (e.g. `text-[13px]`, or a literal colour in a view) makes
  the check fail; removing it makes it pass.
- `design-template.html` opens in a browser and renders with the token vocabulary.
- The render command in `stack.md` produces one PNG when run.
- The mirror generator, run twice, produces no diff the second time.

Report: stack detected, token families installed vs still missing, where the check is
wired, the render method, allowlist debt if any — and the next step: run
`setup-design-foundations` if any family is missing, otherwise `/prototype` the first
screen.
