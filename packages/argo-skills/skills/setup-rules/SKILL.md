---
name: setup-rules
description: Install Argo's engineering rule set into a project — language-agnostic core rules (principles, code style, comments, file structure, testing) plus a per-language binding that names how this stack spells them, all adapted to the detected structure, with a pointer wired into CLAUDE.md/AGENTS.md so Claude Code and Codex actually load them. Ships the TypeScript binding; generates one for any other language at install time. Usually dispatched by the /setup-argo-skills wizard; run directly to (re)install just this piece.
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

They come in two tiers, and the split is what makes this skill work outside a
TypeScript repo. **Core** rules state an intent about shape, structure, or discipline —
those hold in any language, and install everywhere. A **binding** names how one language
or stack spells those intents: its exhaustive branch construct, its checker-silencing
pragmas, its module entry file, its naming convention. A binding never restates a core
rule; it points at it.

**Core — install in every project, whatever the stack:**

| File | Subject |
|---|---|
| `engineering-principles.md` | SOLID/DRY/KISS, thin handlers, compute placement, ground-the-API |
| `code-style.md` | guard clauses, parameter ceiling, line ceiling, naming, boundary validation |
| `comments.md` | comment discipline |
| `file-structure.md` | domain folders, public entry, hoisting tiers, layering |

**Conditional — install when the subject exists here:**

| File | Install when |
|---|---|
| `testing.md` | project has a test runner |
| `dependencies.md` | project has a package manager |
| `ui-components.md` | project has a UI component tree |
| `design-system.md` | project has a design-token layer (e.g. Tailwind v4 `@theme`) |
| `design-studies.md` | the repo holds a prototype/study directory, or a design-tool config, and its UI is the product surface — not merely "has UI" |

`ui-components.md` ships shaped for a **TypeScript web** tree: Storybook, DOM elements,
CSS classes. On any other UI stack that file needs *rewriting*, not trimming — treat it
like a binding (§3) and derive it from the shipped one against the actual framework. If you
can't do that faithfully, defer it and say so; a component rule whose every example is from
another framework teaches an agent to discount the file.

**Bindings — install the one(s) matching the languages actually present:**

| File | Install when |
|---|---|
| `typescript-style.md` | project has `.ts`/`.tsx` |
| `<language>-style.md` | **generated** at install time — see §3 |

Only the TypeScript binding ships. A binding is short and mechanical enough to derive
from the core rules plus the target language, so for any other language you write it
during install rather than shipping five untested files. §3 is that procedure.

`documentation-*.md` and `database.md` are **not** in this set — bring them later,
individually, once the infra they reference (docs site, DB) actually exists.

`testing.md` installs only when a runner exists. No runner and no test files? Defer it
and say so — a testing rule in a repo with no tests is an instruction the agent can't act
on. Its prose is runner-agnostic, so detection only has to name the tool.

These rules pair with the **`setup-quality-gates`** skill, which encodes the
mechanically checkable subset (complexity, function length, parameter count, escape
hatches, duplication) into whatever linter the repo runs, as errors. Prose for
judgment, lint for arithmetic — and they must not contradict each other, so if the
gates skill lands different numbers than a rule states, the rule text follows the
config.

## 2. Detect the project's structure

Discover the concrete values before substituting — read each off the repo, never assume it:

- **Languages present** — count source files by extension, not by what the README claims.
  Anything holding a real share of the codebase needs a binding (§3). Ignore config and
  generated files.
- **Package manager / build tool** — the ecosystem's manifest and lockfile pair
  (`package.json` + `bun.lock`/`pnpm-lock.yaml`/`package-lock.json`, `pyproject.toml` +
  `uv.lock`/`poetry.lock`, `go.mod` + `go.sum`, `composer.json` + `composer.lock`,
  `Cargo.toml` + `Cargo.lock`). Read the add/remove commands off whichever it is.
- **Public entry mechanism** — how this stack exposes a module's API: a barrel `index.ts`,
  a package `__init__.py`, a Go package's exported identifiers, a `mod.rs`, a PSR-4
  namespace. `file-structure.md` needs this by name.
- **App path** — the workspace holding the app (e.g. `apps/desktop`). Read it off the
  workspace/module declaration.
- **Source root** — where app source lives (e.g. `apps/desktop/src/renderer/src`
  for Electron; `apps/web/src`, `src/`, `<pkg>/` otherwise). Find it, don't guess.
- **Components dir** — search for an existing components folder (e.g.
  `.../components`). If none exists yet, still install `ui-components.md` but set the
  path to where components *will* live per the file-structure rule.
- **Tokens CSS** — the file with the Tailwind v4 `@theme` block (search for `@theme`).
  If Tailwind v4 isn't set up, **defer `design-system.md`** and say so.
- **Layer dirs** — for the file-structure boundary example, the two top-level layers
  that must not cross-import (e.g. `main/` ↔ `renderer/` for Electron; `server/` ↔
  `client/` otherwise). **Many repos have no such split** — a single-process mobile or CLI
  app, or one whose environment split is a filename suffix rather than a directory. Don't
  manufacture one: `{{LAYER_BOUNDARY}}` is a whole sentence, and when there are no layers
  to name it degrades to the intra-layer half alone.
- **Conventions already in force** — the casing of existing files and folders, any folder
  the framework reserves (a router directory whose filenames become URL segments, a
  migrations directory), and whether the bundler resolves platform variants by suffix
  (`.web.tsx`, `.ios.ts`). These decide the reconciliation in §5, so read them before
  substituting, not after a rule has already contradicted one.
- **Documentation-comment form and surfaces** — which generator, if any, renders comments
  verbatim here, and which form it reads. `comments.md` needs both by name, and the form is
  language-specific and mutually exclusive: `go doc` reads a plain `//` block and a block
  comment there fails `gofmt`; TSDoc/JSDoc read `/** */` and ignore `//`; Python tooling
  reads a `"""…"""` docstring *inside* the definition. Check the generator; never assume
  "docblock" means the C-style form.

If a project is empty/fresh (app scaffold with no `src` yet), that's fine — install the
always-on rules, and for the UI rules point paths at the intended structure, noting they
activate once source lands.

## 3. Write the language binding

Skip this if TypeScript is the only language — `typescript-style.md` already is the
binding. Otherwise, for each language detected in §2, produce `<language>-style.md` by
resolving `code-style.md`'s intents against that language. Model it on
`typescript-style.md`: an intent→spelling table, then only the sections that have no core
equivalent.

Resolve each row **against the language and its installed toolchain, not from memory** —
the same discipline `engineering-principles.md` demands of any external call. Read the
style guide the ecosystem actually standardised on (PEP 8, Effective Go, PSR-12), and
check the pragma and construct names against the installed version:

| Intent from `code-style.md` | What the binding must name |
|---|---|
| Exhaustive branch construct | the construct, and how to make a missed case fail (`match` + `assert_never`, a linter's exhaustiveness rule, a compiler switch) |
| Checker-silencing pragmas | this language's list (`# type: ignore`, `@SuppressWarnings`, `//nolint`, `unsafe`, `@phpstan-ignore`) |
| Validate at the boundary | the ecosystem's parse-don't-declare tool (Pydantic, `encoding/json` + validation, a schema library) |
| Naming convention | the casing this language uses for files, types, functions, constants |
| Public entry | how a module declares its API — pairs with `file-structure.md`'s `{{PUBLIC_ENTRY}}` |
| Line-ceiling exemptions | which file kinds are genuinely exempt here (generated clients, migrations, fixtures) |

Two rules for the binding you write:

- **It points, never restates.** If a section would repeat a core rule's rationale, cut it
  to the table row. A reader who wants the why opens `code-style.md`.
- **Nothing goes in that you didn't verify.** A pragma name or construct you're unsure of
  is left out and reported, exactly like an unresolvable lint rule in
  `setup-quality-gates`. A binding that names a construct the language doesn't have is
  worse than a shorter one.

## 4. Substitute the placeholders

Replace every `{{TOKEN}}` with the detected value. The **Example** column shows one
concrete instance — an Electron monorepo — but these rules serve any stack: a web app
substitutes its own root (`src/…`, `apps/web/src/…`), a Python package its module tree.
Detect the values (§2); don't copy the examples. The full token set:

| Token | Meaning | Example |
|---|---|---|
| `{{SOURCE_GLOBS}}` | every source glob `file-structure.md` governs, one per line | `apps/desktop/**/*.{ts,tsx}` + `packages/**/*.{ts,tsx}` |
| `{{PUBLIC_ENTRY}}` | this stack's module front door | `index.ts` (Python: `__init__.py`; Rust: `mod.rs`) |
| `{{SHARED_TIER}}` / `{{GENERIC_TIER}}` | where a helper hoists on its third caller | `lib/` / `lib/generic/` |
| `{{MANIFEST}}` | the ecosystem's manifest glob | `**/package.json` (Python: `**/pyproject.toml`) |
| `{{WORKSPACE_NOTE}}` | one sentence on where install runs, or empty | `This is a bun workspaces monorepo (\`apps/*\`, \`packages/*\`) — always install from the repo root so the single lockfile stays authoritative.` |
| `{{QUERY_LADDER}}` | the project's UI query ladder, or empty when it has no UI | `Query the accessibility tree in this order: \`getByRole\` → \`getByLabelText\` → \`getByText\`. \`getByTestId\` is the last resort.` |
| `{{LAYER_BOUNDARY}}` | one sentence naming the boundaries that hold here | `\`main/\` never imports from \`renderer/\`, and within a layer, feature folders never import each other's leaves.` (no layer split: drop the first clause) |
| `{{DOC_COMMENT_FORM}}` | one sentence naming the generator and the exact form it reads, or empty when nothing renders comments | `TSDoc renders \`/** */\` above the declaration; a \`//\` comment in that position is dropped.` |
| `{{DOC_SURFACES}}` | where the rendered surfaces are documented, or empty | `For UI components, see \`ui-components.md\`.` |
| `{{COMPONENTS_GLOB}}` | components glob | `apps/desktop/src/renderer/src/{domains,shared}/**/*.{ts,tsx}` |
| `{{COMPONENTS_DIR}}` | components dir (trailing slash) | `apps/desktop/src/renderer/src/shared/components/` |
| `{{RENDERER_GLOB}}` | renderer css/tsx glob | `apps/desktop/src/renderer/src/**/*.{css,tsx,jsx}` |
| `{{TOKENS_CSS}}` | file holding the `@theme` block | `apps/desktop/src/renderer/src/styles/globals.css` |
| `{{LOCKFILE}}` | lockfile glob | `**/bun.lock` (Python: `**/uv.lock`; Go: `**/go.sum`) |
| `{{PKG_ADD}}` / `{{PKG_REMOVE}}` | add/remove commands | `bun add` / `bun remove` (Python: `uv add` / `uv remove`) |
| `{{COMPONENT_KIT}}` | how this repo's configured kit supplies primitives | `This is a configured shadcn project (\`components.json\`) — \`bunx shadcn@latest add <name>\` is where a badge, dialog or select comes from.` |
| `{{TEST_GLOB}}` | test-file glob for `testing.md`'s `paths:` | `**/*.{test,spec}.{ts,tsx}` (add `e2e/**` if a separate suite exists) |
| `{{TEST_RUNNER}}` | the unit runner, named | `Vitest` (Python: `pytest`) |
| `{{E2E_RUNNER}}` | the integration/E2E runner, or how to say there isn't one | `Playwright` (none yet: `no E2E suite yet — the critical-path rule below is the reason to add one`) |

A token that resolves to nothing resolves to **empty**, and the sentence around it must
still read — that's why several are whole sentences rather than values. Delete the orphaned
lead-in when you empty one.

`{{DOC_SURFACES}}` is empty unless the file it would point at is actually being installed.
A pointer to a rule this run deferred is a dead end for the agent that follows it.

`{{COMPONENT_KIT}}` is a short block, not a bare value: name the kit, its add-command, its
config file, and its icon-swap convention (e.g. shadcn: `bunx shadcn@latest add <name>`,
`components.json`, its generated-icon swap). On a repo with **no** kit, degrade it to a
sentence pointing at the primitives directory ("no generator — build primitives by hand in
`shared/components/ui/`"), so the reuse gate in `ui-components.md` still reads.

A token is never wrapped in backticks in the template — several values carry their own
inline code spans, and nesting them produces broken markdown. Format inside the value.

After substitution, **grep the installed files for `\{\{[A-Z0-9_]+\}\}`** — a leftover token
means detection missed something. Fix it before finishing; never ship one.

Match that pattern, not a bare `{{`: rule files legitimately contain `{{` inside code samples
(JSX `style={{ }}`, a template language, a shell expansion), and a grep that flags those
trains you to ignore it. Include the digits — `{{E2E_RUNNER}}` is invisible to `[A-Z_]+`, and
a pattern that silently skips one token is worse than no check, because it reports clean.

## 5. Reconcile with reality

### 5a. When a shipped rule contradicts what the repo already does

This is the most consequential judgement in the run, and it has an answer. Sort the
conflict into one of two kinds before touching anything:

- **The repo's convention is load-bearing** — the framework, bundler, or a tool reads it.
  Filenames that become URL segments, a reserved directory, a platform-variant suffix, a
  generator's output location. **The repo wins, always.** Rewrite the rule's text so it
  states this repo's convention, and record the deviation in the report. Never install a
  rule an agent must break to keep the build green: the first time a house rule loses to
  reality, every other house rule becomes advisory too.
- **The convention is merely habitual** — a casing style nothing enforces, a folder layout
  that predates the rule. **The house rule wins**, and the existing files are pre-existing
  non-conformance: don't mass-rename, don't weaken the rule. Say in the report how many
  files don't conform, so the number is known rather than discovered.

If you cannot tell which kind it is, it's load-bearing until proven otherwise — the cost of
wrongly deferring to the repo is a rule that's weaker than intended; the cost of wrongly
overruling it is a broken build.

Two conflicts must never survive the run, whichever way you resolve them: a rule that
contradicts **another installed rule** (check the pair whenever you edit one), and a rule
naming a **path, folder, or file that doesn't exist here**. Grep the installed set for every
path it mentions and confirm each resolves.

### 5b. Trim

Read each substituted file once and cut anything that doesn't apply here:

- No headless-UI lib (Radix) yet? Drop that clause from `ui-components.md`.
- Not Electron? Replace the `WebkitAppRegion` escape-hatch example in `design-system.md`
  with a platform-relevant one, or drop it.
- No boundary linter? The "enforce mechanically" note in `file-structure.md` stays as
  aspiration but don't invent a config path.

- Language the binding doesn't apply to? Cut the row rather than inventing a construct.
- **Examples in the wrong language.** The core rules illustrate with names, not filenames,
  but check anyway: grep the installed core rules for file extensions, package-manager
  names, and ecosystem nouns that don't belong in this project (`.ts`, `npm`, `node_modules`,
  `pip`). Each hit is either rewritten in this stack's terms or dropped. A Python repo that
  reads house rules full of `.ts` filenames learns to discount them.
- **Per-language enumerations, in either direction.** Any parenthetical listing several
  languages' spellings of one idea collapses to this repo's single spelling — a
  TypeScript-only repo should not be reading about `match`/`case` or dataclasses any more
  than a Python one should be reading about `.ts` files. The core rules are written to keep
  these to a minimum; the ones that remain live in the binding's table, not in the core.

Keep the forbidden-lists and self-checks — those are the parts that change behavior.

## 6. Write the files

Write the adapted rules to **`rules/`** at the repo root (create it). Use a neutral,
agent-agnostic location — not `.claude/rules/` — since the rules are consumed equally by
every agent (Claude Code, Codex, …) via the pointer, and nothing auto-loads them by path.
Keep each file's `paths:` frontmatter — it's how the rule scopes itself to matching files.

## 7. Wire the pointer (so agents actually load them)

Stock Claude Code and Codex do **not** auto-load `rules/*.md` by path-glob. Without a
pointer the files are inert. Add a **Rules** section at the repo root: if `CLAUDE.md` merely
imports `AGENTS.md` (its whole body is `@AGENTS.md`), put the section in `AGENTS.md` only —
adding it to both would duplicate it via the import. Otherwise wire both. Group by concern so
a backend task isn't pulled into UI rules:

```markdown
## Rules

House engineering rules live in `rules/`. Load the ones matching the files you
touch (each rule's `paths:` frontmatter states its scope):

- **All code** — `engineering-principles.md`, `code-style.md`, `comments.md`,
  `file-structure.md`, `dependencies.md`
- **<Language> code** — also `<language>-style.md` (one line per language present)
- **Tests** — also `testing.md`
- **UI work** — also `ui-components.md`, `design-system.md`, `design-studies.md`
```

The **All code** line lists only the core rules — those bind every language. Each binding
gets its own line so a Python task isn't pulled into TypeScript's escape-hatch list.

If `CLAUDE.md`/`AGENTS.md` already has a Rules section, update it rather than duplicating.

## 8. Report

Tell the user: which core rules were installed, which bindings were installed vs
**generated** (and for a generated one, any intent you left out because you couldn't verify
its construct), which rules were **deferred** and why (e.g. "`design-system.md` deferred —
no Tailwind v4 `@theme` block found yet"), and the files the pointer was wired into.

Then the two things only this run can know, which the user cannot recover by reading the
installed files:

- **Every rule you rewrote because the repo's convention won** (§5a), with the convention
  and why it was load-bearing. This is where a bad call gets caught.
- **Every rule the repo does not currently conform to**, with the file count. A house rule
  that lands over 40 non-conforming files is a decision, and it should be a visible one.

Suggest they skim the installed rules and prune anything that still doesn't fit — the import
step is where the value is.
