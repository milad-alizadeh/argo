---
name: audit-agent-context
description: Price what a project loads into every agent session before the first prompt, find the bloat in its agent documents, and cut it. Use when CLAUDE.md or AGENTS.md feels bloated, sessions cost or fill up too fast, rules restate what the linter already gates, or rules and skills with no subject in the tree should be found and removed.
---

# Audit Agent Context

Report first, edit only what the user accepts. Argue **spend** and **headroom**, which §1
prices, never adherence: a smaller context file has not been shown to make an agent follow
instructions better, and the claim is uncheckable here.

## 1. Measure what loads before the first prompt

Work from `git rev-parse --show-toplevel`. Always-on is everything the model receives before
the user types:

| Source | How to find it |
|---|---|
| Root agent file | `CLAUDE.md`, `AGENTS.md`, and any other root file the harness reads |
| Its `@`-import chain | Every `@path` line, **resolved transitively**: an import pastes the whole file into every request |
| Output style | The one named by `.claude/settings.json`'s `outputStyle`, if any |
| Skill frontmatter | `name` + `description` of every installed skill, deduped by name across skills directories |
| Memory index | The always-on index file, not the memories it points at |

Report bytes per source, then tokens, and say which of three conversions you used:

- **Weigh by difference.** Run a trivial prompt against a scratch copy of the project, whole
  and then with one source removed; the drop is that source's cost in the harness's own
  accounting (Claude Code: `claude -p "Reply with exactly: ok" --output-format json`, cost =
  input + cache creation + cache read). Reproduce the whole import chain in the copy, or a
  file loaded only through an import measures a confident zero. Weigh the few dominant
  sources, since each probe is a paid call.
- **A count the harness reports.** Take its per-source figures, never its grouping: a bucket
  named for the vendor can hold project-owned content, an output style commonly does.
- **Bytes ÷ 2.6.** Agent files are dense in tables and paths; prose's 3.5 under-reports them.

Price the total twice. **Spend** is tokens × turns per session, because always-on content is
re-sent every turn. **Headroom** is the same tokens as a share of a **120k working region**,
the span a model still reasons well across, which is a property of the models and not of the
advertised window. Report bytes and tokens, never a percentile against other repos.

## 2. Find what does not earn its place

Run the bundled script first; it measures checks 2 and 6–10 mechanically and prints a file
and a byte count per finding:

```bash
node <this-skill-dir>/scripts/audit-bloat.mjs <repo-root>
```

Each check ends in a byte count and a named file, or it did not run.

1. **The content-expanding `@` import.** A root file importing a large document moves it
   from pull to push. Report the imported file's size next to the importer's.
2. **Duplicate root files.** `CLAUDE.md` and `AGENTS.md` with the same body; identical content
   loaded twice is paid twice.
3. **Rules and skills with no subject.** Check each rule's `paths:` frontmatter against the
   working tree and each skill's subject against the manifest; a rule matching zero files can
   only misfire. A subject is dead only when the report quotes its zero-hit search over
   **tracked files on the current branch**, excluding every path `git worktree list` names,
   build output and vendored copies, since one stale hit in any of those clears a dead subject
   as live.
4. **Inlined runbooks.** Step-by-step procedures and troubleshooting in an always-on file are
   read once a task starts, which makes them pull material.
5. **Per-tool-call hook injection.** Read the hook config for hooks that return context, run
   one against a realistic payload, count the bytes, multiply by plausible call counts. No
   byte-count of files can see this, and it is the only cost that grows with session length.
6. **Prose that restates a gate.** A rule stating a cap or a ban the linter config already
   errors on (a line count, a parameter count, `any`, a force unwrap). The config is the
   source and the prose a cache that drifts; the fix is a pointer at the config. The script
   lists caps and escape-hatch names found in `rules/` beside the lint configs it found.
7. **Self-check lists.** A section that restates the rules above it as questions. Delete it.
8. **Decision history inside instruction.** Issue numbers, ADR names, study citations and
   "this shipped backwards once" inside a rule or skill are reasoning, not instruction; they
   belong in an ADR, a design doc or the commit. The script reports reference density per
   file and which rule files the most commits touched, since a rule file that grows on every
   feature PR is being used as a changelog.
9. **The same sentence in more than one file.** The script lists repeated sentences across
   the root file, `rules/` and installed skills with every site. Count the sites, name the
   survivor, and re-point the rest.
10. **Skill size.** Frontmatter is billed every turn whether or not a skill fires, so a large
    bundle costs more than any single document and installing a subset is the fix. A body is
    billed when it fires; the script flags bodies over 8 KB, and for each one ask what belongs
    behind a pointer in a sibling file.

## 3. Three placements, not two

- **Inline** stays always-on. Correct only when a session that never touches the subject is
  still worse off without it.
- **Pointer** is a path in prose, read on demand. The default; it fails when the session does
  not follow it, so it suits detail a task will go looking for anyway.
- **Nested** is a context file in the directory it governs, loaded when work happens there.
  The right home for anything scoped to one part of the tree. Check the harness first: one
  that does not walk the tree cannot see a nested file, so choose pointer instead.

Apply the two questions per section of the always-on file, not to the file as a whole, and put
the verdict beside the byte count. Done when every section carries one of the three words.

## 4. Report, then cut what the user accepts

Rank findings by bytes. Each line names a file, a byte count and the edit. Before proposing a
move, grep the tree for references to what is moving; a section other files cite by name
cannot become a pointer without re-pointing them, and the citation count goes in the report.
A cut whose failure is silent, content that will simply stop being read, is called out as such
and left for the user to decide.

Apply only the accepted findings, then re-run §1 and the script. Report before and after
totals and the headroom share. If the after figure is not lower, say so rather than reporting
the plan as the outcome.
