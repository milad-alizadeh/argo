---
name: setup-design-handoff
description: Install the design→code handoff machinery into a project — a token contract (the single named-decision layer for colors, type roles, spacing), design-study scaffolding (docs/designs/ + kit + naming conventions), and a mechanical no-raw-values check wired into CI. Framework-agnostic — adapts to Tailwind v4, React Native/Tamagui, or a multi-platform DTCG pipeline. Usually dispatched by the /setup-argo-skills wizard (after setup-rules); run directly to (re)install just this piece.
disable-model-invocation: true
---

# Setup Design Handoff

Make the design-study → production-component handoff survivable in *this* project.
The system rests on one idea: **the contract is a set of named design decisions**
(tokens + component names). Studies, apps, and every framework rendering of the
design speak only in those names. This skill installs the three mechanical pieces
that hold the contract: the token layer, the study scaffolding, and the
enforcement check. The *prose* rules (`design-system.md`, `design-studies.md`,
`ui-components.md`) come from `setup-rules` — run that first if the repo has no
`rules/` yet.

**Golden rule: adapt, don't dump.** Every path, glob, and command installed must
resolve to something real in this repo.

## 1. Detect the target stack

Look before asking: `tailwindcss` in package.json? `tamagui` / `react-native`?
Both (a monorepo with web + native workspaces)? Confirm with the user, then pick
the token-layer shape:

| Stack | Token contract | Wiring |
|---|---|---|
| Web + Tailwind v4 | one CSS custom-property file (`:root` + theme variants) | `@theme inline` block maps vars → utilities |
| React Native / Tamagui | `tokens.ts` feeding `createTokens()` | Tamagui config imports it |
| Multi-platform | DTCG `tokens.json` (W3C design-tokens format) | Style Dictionary build → per-target outputs (CSS vars, `tokens.ts`) |

For multi-platform, **look up the current Style Dictionary docs online before
wiring** — don't hand-author config from memory. The JSON is then the only
hand-edited file; the CSS/TS outputs are generated and never edited.

## 2. Install or complete the token contract

If a token layer already exists, **extend, never replace**. The contract must
cover all four families before the handoff works; most projects that "have
tokens" have only colors:

1. **Color roles** — semantic (`background`, `foreground`, `muted`, `border`,
   status roles), themed per variant (light/dark).
2. **Typography roles** — a small fixed ramp (micro / label / body / body-lg /
   title / display), each a **full tuple**: size + line-height + weight +
   letter-spacing. Named by role, never by value.
3. **Spacing roles** — the rhythm steps the design actually uses.
4. **Radii / durations / opacity** as used.

This skill installs the *structure*; the values are design work. When families
are missing, run `/design-foundations` next — the moodboard→contract ceremony
that designs the ramps deliberately from whatever exploration exists (studies,
the app's CSS) and lands them only behind a user bless. Never derive a scale
inline here or copy a study's raw values into the contract.

## 3. Install the study scaffolding

- Create `docs/designs/` + `README.md` index (per the `design-studies` rule).
- Install `docs/designs/tokens.css` **generated or mirrored from the contract**
  so studies import the real vocabulary — plus `kit.js` (starts empty; grows
  named render functions as studies repeat shapes).
- Seed a `study-template.html` that: imports `tokens.css`, styles only via
  `var(--token)`, and shows the `data-component="PascalCaseName"` region-naming
  convention inline as a worked example.
- If the repo ignores docs in a knowledge graph (`.graphifyignore`), confirm
  `docs/designs/` is covered.

## 4. Install the enforcement check

Copy `templates/check-design-tokens.sh` (next to this SKILL.md), substitute its
placeholders, and make it executable:

| Placeholder | Meaning | Example |
|---|---|---|
| `{{SRC_DIRS}}` | space-separated dirs to scan | `apps/desktop/src/renderer/src/components` |
| `{{EXCLUDE_FILES}}` | token/theme files where raw values are legal | `argo-tokens.css globals.css` |

- Add a root script: `"check:design-tokens": "sh scripts/check-design-tokens.sh"`.
- Wire it into CI (append a step to an existing lint/boundaries workflow rather
  than adding a new one, when possible) and into the pre-commit hook if the repo
  has one.
- **For React Native targets**, adapt the patterns at install time: quoted hex
  literals and numeric `fontSize:`/`padding:` style-object literals instead of
  Tailwind arbitrary values. Keep the same allowlist mechanism.
- Run it once. If the existing codebase fails, seed the allowlist with the
  current offenders **and file one debt ticket** listing them — the check must
  be green on install, and the debt visible, or it gets disabled within a week.

## 5. Verify and report

- A deliberately-bad line (e.g. `text-[13px]`) makes the check fail; removing it
  makes it pass.
- Studies template opens in a browser and renders with the token vocabulary.
- Report: stack detected, token families installed vs derived-from-settling,
  where the check is wired (script / CI / pre-commit), allowlist debt if any,
  and the next step — run `/componentize-design` on the first settled study.
