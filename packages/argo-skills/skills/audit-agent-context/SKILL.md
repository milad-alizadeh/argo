---
name: audit-agent-context
description: Measure what a project loads into every agent session before the first prompt, and cut it. Use when the user says their CLAUDE.md or AGENTS.md is too long or bloated, asks why context fills up so fast or why sessions cost so much, asks how much of the usable window is gone before the first prompt, asks what the agent reads before it does anything, or wants rules and skills with no subject in the tree found and removed.
---

# Audit Agent Context

Every other `setup-*` skill *writes* into a project. This one reads what is already there,
prices it, and proposes cuts. Report first, edit only what the user accepts.

**The case is spend and headroom, never adherence.** Never tell the user a smaller context
file makes the agent follow instructions better — the largest study to test that directly
(1,650 sessions) returned affirmative-null Bayes factors for context-file size against
compliance. Two other claims are true and checkable, and they are enough:

- **Spend.** Always-on tokens are re-sent every turn, so they are billed every turn.
- **Headroom.** They occupy the working region for the whole session, and nothing evicts
  them, so the session reaches degraded ground sooner.

Neither says the file itself is read worse.

## 1. Measure what loads before the first prompt

Work from the repo root (`git rev-parse --show-toplevel`). Always-on is everything the model
receives before the user types:

| Source | How to find it |
|---|---|
| Root agent file | `CLAUDE.md`, `AGENTS.md`, and any other root file the harness reads |
| Its `@`-import chain | Every `@path` line, **resolved transitively** — an import pastes the whole file into every request |
| Output style | The one named by `.claude/settings.json`'s `outputStyle`, if any |
| Skill frontmatter | The `name` + `description` of every installed skill, in each skills directory. Dedupe by skill name — a `.claude/skills/<n>` symlink into `.agents/skills/<n>` is one skill loaded once |
| Memory index | The always-on index file, not the memories it points at |

Report bytes per source, the total, and tokens at roughly 3.5 bytes per token. Say which
divisor you used, because the number is an estimate and the user may re-derive it.

Then price the total twice.

**Spend** — tokens × turns per session. A 20k always-on file over a 40-turn session is 800k
tokens of re-sent context.

**Headroom** — always-on tokens as a share of the *working region*, not of the advertised
window. The window is the hard limit; the working region is the span the project actually
wants to stay inside, and it is the smaller number. Ask the user for theirs; absent an
answer use 120k, name the figure in the report, and invite them to replace it. A 20k
preamble against a 120k region is 17% spent before the first prompt, on every session
including the ones that never touch its subject.

Report the headroom share beside the byte counts.

Do not rank the project against other repos. A percentile needs a corpus the user cannot
see, ages the moment it ships, and implies a better and worse end of a distribution — which
is the adherence claim in numeric clothing. Report bytes and tokens.

## 2. Find what does not earn its place

Six checks. Each one ends in a byte count and a named file, or it did not run.

1. **The content-expanding `@` import.** A root file importing a large document moves it
   from pull to push. Rare, and the single largest finding when present. Report the imported
   file's size next to the importer's.
2. **Duplicate root files.** `CLAUDE.md` and `AGENTS.md` with the same body, or three copies
   of one file. Diff them; identical content loaded twice is paid twice.
3. **Rules and skills with no subject.** A rule about a language the tree does not contain,
   a skill for a framework nothing imports. Check each rule's `paths:` frontmatter against
   the working tree, and each skill's subject against the manifest — a rule matching zero
   files can only misfire. Verify by globbing before claiming absence.
4. **Inlined runbooks.** Step-by-step procedures, command sequences, and troubleshooting in
   an always-on file. These are read once a task starts, which makes them pull material.
5. **Per-tool-call hook injection.** Read the harness's hook config for hooks that return
   context. Measure one fire by running the command against a realistic payload and counting
   the bytes it emits, then multiply by plausible call counts. **No byte-count of files can
   see this**, and it is the only cost that grows with session length — a hook on a
   frequently-used tool routinely outweighs the root file.
6. **Skill frontmatter as a whole.** Every installed skill is billed every turn whether or
   not it is ever used. If the count is large, the honest finding is that the bundle costs
   more than any single document, and installing a subset is the fix.

## 3. Offer three placements, not two

For each finding, the choice is not only "keep or delete":

- **Inline** — stays always-on. Correct when a task that never touches the subject still
  needs it, and for anything a session must not be able to miss.
- **Pointer** — a path in prose, read on demand. Cheapest, and it fails when the session
  does not follow it, so it suits detail a task will go looking for anyway.
- **Nested** — a context file in the directory it governs, loaded when work happens there.
  Answers pointer-rot mechanically rather than by spending always-on budget, and it is the
  right home for anything scoped to one part of the tree.

Two things decide between them: does a session that never touches this subject still need
it (inline), and is the subject confined to a directory (nested)?

**Pointer is the default; inline is the exception that gets argued for.** Inline is the only
one of the three that spends working region on every session, so the test a section has to
pass is not "is this true and useful" but "would a session that never touches this subject
be worse off without it". Apply that test to each section of the always-on file, not to the
file as a whole, and put the verdict in the report beside the byte count.

**Check the harness first.** Nested loading is a per-harness behaviour and the filename
matters. If the project's agents include one that does not walk the tree, a nested file is
invisible to it — say so and choose pointer instead. If the project already uses nested
files, follow the convention it has rather than introducing a second one.

## 4. Report, then cut what the user accepts

Rank findings by bytes. Each line gets a file, a byte count, and the edit — not an
adjective. Say what a finding would save and what it would cost:

- Nothing that only one always-on file states may leave without a home. Before proposing a
  move, grep the tree for references to what is moving; a section other files cite by name
  cannot become a pointer without re-pointing them, and the count of citations goes in the
  report.
- A cut whose failure is silent — content that will simply stop being read, with nothing
  raising an error — is called out as such and left for the user to decide.

Then apply only the accepted findings, and re-run §1. Report the before and after totals and
the before and after headroom share. If the after figure is not lower, say so rather than
reporting the plan as the outcome.
