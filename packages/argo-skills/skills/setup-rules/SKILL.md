---
name: setup-rules
description: Install Argo's engineering rule set into a project — copies the rule templates (engineering principles, comments, TypeScript style, dependencies, file structure, UI components, design system) into the repo, adapts every path to the detected structure, and wires a pointer into CLAUDE.md/AGENTS.md so Claude Code and Codex actually load them. Usually dispatched by the /setup-argo-skills wizard; run directly to (re)install just this piece.
disable-model-invocation: true
---

# Setup Rules

Materialize the Argo rule templates into the current project as house rules, adapted
to *this* repo's actual structure, and wire them so agents load them. The templates
ship **inside this skill** at `rules/` (colocated next to this `SKILL.md`) — generic
versions carrying `{{PLACEHOLDER}}` tokens. This skill's job is to copy, substitute,
trim, and wire.

**Golden rule: adapt, don't dump.** A rule that references a path or tool the project
doesn't have is bloat — it's an instruction the agent can't act on. Every path in the
installed rules must resolve to something real in *this* repo. If a rule's whole subject
doesn't exist here yet (no Tailwind, no components dir, no bundler), don't install that
rule — note it as deferred.

## 1. Locate the templates

The templates live in this skill's own `rules/` directory — resolve it relative to
this `SKILL.md` (e.g. `<this-skill-dir>/rules/*.md`), wherever the skill was installed.
The Tier-1+2 set is:

| File | Subject | Install when |
|---|---|---|
| `engineering-principles.md` | SOLID/DRY/KISS forbidden-lists | always (language-agnostic) |
| `comments.md` | comment discipline | always |
| `typescript-style.md` | switch/ternary/naming/aliases | project has `.ts`/`.tsx` |
| `dependencies.md` | lockfile + workspace hygiene | project has a package manager |
| `file-structure.md` | domain folders, barrels, boundaries | always (TS/JS projects) |
| `ui-components.md` | atomic design, container/View, icons | project has a UI component tree |
| `design-system.md` | tokens-only, no magic numbers | project uses Tailwind v4 tokens |
| `design-studies.md` | HTML design studies → `docs/designs/`, committed | project does UI design/prototyping |

`testing.md`, `documentation-*.md`, and `database.md` are **not** in this set — bring
them later, individually, once the infra they reference (test runner, docs site, DB)
actually exists.

## 2. Detect the project's structure

Discover the concrete values before substituting — read each off the repo, never assume it:

- **Package manager** — read the root `package.json` (`packageManager` field) and which
  lockfile exists (`bun.lock`, `pnpm-lock.yaml`, `package-lock.json`).
- **App path** — the workspace holding the UI app (e.g. `apps/desktop`). Read root
  `package.json` `workspaces`.
- **Renderer/src root** — where app source lives (e.g. `apps/desktop/src/renderer/src`
  for Electron; `apps/web/src` or `src/` otherwise). Find it, don't guess.
- **Components dir** — search for an existing components folder (e.g.
  `.../components`). If none exists yet, still install `ui-components.md` but set the
  path to where components *will* live per the file-structure rule.
- **Tokens CSS** — the file with the Tailwind v4 `@theme` block (search for `@theme`).
  If Tailwind v4 isn't set up, **defer `design-system.md`** and say so.
- **Layer dirs** — for the file-structure boundary example, the two top-level layers
  that must not cross-import (e.g. `main/` ↔ `renderer/` for Electron; `server/` ↔
  `client/` otherwise).

If a project is empty/fresh (app scaffold with no `src` yet), that's fine — install the
always-on rules, and for the UI rules point paths at the intended structure, noting they
activate once source lands.

## 3. Substitute the placeholders

Replace every `{{TOKEN}}` with the detected value. The **Example** column shows one
concrete instance — an Electron monorepo — but these rules serve any app kind: a web app
substitutes its own root (`src/…`, `apps/web/src/…`), a React Native app its screen tree.
Detect the values (step 2); don't copy the examples. The full token set:

| Token | Meaning | Example |
|---|---|---|
| `{{APP_GLOB}}` | app source glob | `apps/desktop/**/*.{ts,tsx}` |
| `{{MAIN_DIR}}` / `{{RENDERER_DIR}}` | the two non-cross-importing layers | `main/` / `renderer/` (web: `server/` / `client/`) |
| `{{COMPONENTS_GLOB}}` | components glob | `apps/desktop/src/renderer/src/components/**/*.{ts,tsx}` |
| `{{COMPONENTS_DIR}}` | components dir (trailing slash) | `apps/desktop/src/renderer/src/components/` |
| `{{RENDERER_GLOB}}` | renderer css/tsx glob | `apps/desktop/src/renderer/src/**/*.{css,tsx,jsx}` |
| `{{TOKENS_CSS}}` | file holding the `@theme` block | `apps/desktop/src/renderer/src/assets/base.css` |
| `{{PKG_MANAGER}}` | package manager name | `bun` |
| `{{PKG_ADD}}` / `{{PKG_REMOVE}}` | add/remove commands | `bun add` / `bun remove` |
| `{{COMPONENT_KIT}}` | how this repo's configured kit supplies primitives | `This is a configured shadcn project (\`components.json\`) — \`bunx shadcn@latest add <name>\` is where a badge, dialog or select comes from.` |

`{{COMPONENT_KIT}}` is a short block, not a bare value: name the kit, its add-command, its
config file, and its icon-swap convention (e.g. shadcn: `bunx shadcn@latest add <name>`,
`components.json`, its generated-icon swap). On a repo with **no** kit, degrade it to a
sentence pointing at the primitives directory ("no generator — build primitives by hand in
`shared/components/ui/`"), so the reuse gate in `ui-components.md` still reads.

After substitution, **grep the installed files for any remaining `{{`** — a leftover
token means detection missed something. Fix it before finishing; never ship a `{{...}}`.

## 4. Trim to reality

Read each substituted file once and cut anything that doesn't apply here:

- No headless-UI lib (Radix) yet? Drop that clause from `ui-components.md`.
- Not Electron? Replace the `WebkitAppRegion` escape-hatch example in `design-system.md`
  with a platform-relevant one, or drop it.
- No boundary linter? The "enforce mechanically" note in `file-structure.md` stays as
  aspiration but don't invent a config path.

Keep the forbidden-lists and self-checks — those are the parts that change behavior.

## 5. Write the files

Write the adapted rules to **`rules/`** at the repo root (create it). Use a neutral,
agent-agnostic location — not `.claude/rules/` — since the rules are consumed equally by
every agent (Claude Code, Codex, …) via the pointer, and nothing auto-loads them by path.
Keep each file's `paths:` frontmatter — it's how the rule scopes itself to matching files.

## 6. Wire the pointer (so agents actually load them)

Stock Claude Code and Codex do **not** auto-load `rules/*.md` by path-glob. Without a
pointer the files are inert. Add a **Rules** section to both `CLAUDE.md` and `AGENTS.md`
at the repo root (this repo is single-context — one of each). Group by concern so a
backend task isn't pulled into UI rules:

```markdown
## Rules

House engineering rules live in `rules/`. Load the ones matching the files you
touch (each rule's `paths:` frontmatter states its scope):

- **All code** — `engineering-principles.md`, `comments.md`, `file-structure.md`,
  `typescript-style.md`, `dependencies.md`
- **UI work** — also `ui-components.md`, `design-system.md`, `design-studies.md`
```

If `CLAUDE.md`/`AGENTS.md` already has a Rules section, update it rather than duplicating.

## 7. Report

Tell the user: which rules were installed, which were **deferred** and why (e.g.
"`design-system.md` deferred — no Tailwind v4 `@theme` block found yet"), and the two
files the pointer was wired into. Suggest they skim the installed rules and prune
anything that still doesn't fit — the import step is where the value is.
