---
name: audit-agent-docs
description: Price a project's agent docs, pushed and pulled, and cut the bloat.
disable-model-invocation: true
---

# Audit Agent Docs

Report first, cut what the user accepts. Argue **spend**, never adherence: a smaller context file
has not been shown to make an agent follow instructions better, and the claim is uncheckable here.

**Push** is what the harness sends before the user types, billed every turn. **Pull** is what a
document reaches for once a task starts, billed once when it loads. Every finding below is either
a push cost or something that quietly became one.

## 1. Read the meter

The harness counted already, and an agent cannot see its own context as a number. Ask the user to
run the command and **paste the output**: it renders to their terminal and never reaches you.

| harness | command | what comes back |
| --- | --- | --- |
| Claude Code | `/context` | a per-source breakdown, totalled on the last request's real usage |
| Codex | `/status` | session total, last turn, `model_context_window`. No breakdown. |

Codex also writes a `token_count` record per turn to
`~/.codex/sessions/<yyyy>/<mm>/<dd>/rollout-*.jsonl`, and `codex exec --json` prints the same
events, so a before-and-after there is two file reads rather than two paid runs.

With no breakdown, `wc -c` each source and divide by 2.6 — agent files are dense in tables and
paths, so prose's 3.5 under-reports them. Say which of the two you used.

**The budget is 40k pushed**, about a third of the ~120k region a model still reasons well across,
which is a property of the models rather than of the advertised window. Multiply by turns for
spend; cache reads make that an upper bound. A repo needing more than 40k argues for it in the
report, rather than cutting a live rule to reach a number.

The meter prices the bill and leaves the line items unnamed: it says the memory files cost 12k,
never which section of them was dead. Steps 2 to 5 are the reading.

## 2. Inventory the docs

Work from the repository root. The pushed tier first:

| source | how to find it |
| --- | --- |
| Root agent file | `CLAUDE.md`, `.claude/CLAUDE.md`, `CLAUDE.local.md`, `AGENTS.md`, and any other root file the harness reads |
| Its `@`-import chain | every `@path` line, **resolved transitively**: an import pastes the whole file into every request |
| Unscoped rule | every `.claude/rules/**/*.md` with no `paths:` frontmatter: Claude Code loads it at launch |
| Output style | the one `.claude/settings.json` names in `outputStyle` |
| Skill frontmatter | `name` + `description` of every installed skill, deduped across skills directories by resolved path, so a symlink counts once |
| Memory index | the always-on index file, never the memories behind it |

Then the pull tier, since its bloat is paid per task: `.claude/rules/` files that carry `paths:`,
`docs/agents/`, and any context file in a directory the harness walks.

Done when every source has a byte count and a tier.

## 3. Load `/writing-for-agents`

It carries the pruning tests, so this skill states none of them: no-ops, duplication, sediment,
the information hierarchy, and the environment as a source of truth a document should not cache.

## 4. The five costs it does not price

Each is about how material **loads** rather than how it reads, and each ends in a byte count and a
named file, or it did not run.

1. **The content-expanding `@` import**, which turns a pull document into a push one. Report the
   imported file's size beside the importer's.
2. **Duplicate root files.** `CLAUDE.md` and `AGENTS.md` with one body is one document billed
   twice.
3. **A rule with no subject.** Check each rule's `paths:` frontmatter against the working tree; one
   matching zero files can only misfire. Call it dead only on a zero-hit search over **tracked
   files on the current branch**, excluding every path `git worktree list` names, build output and
   vendored copies, since one stale hit anywhere clears it as live.
4. **Skill-bundle frontmatter**, pushed every turn whether or not a skill fires, so a large bundle
   outweighs any single document and installing a subset is the fix. Codex says so itself when the
   bundle overflows — *"Skill descriptions were shortened to fit the skills context budget"* — and
   truncates rather than growing the prompt, so it arrives as worse triggering and no error.
5. **Per-tool-call hook injection**, the only cost that grows with session length and the only one
   no byte count can see. Read the hook config for hooks that return context, run one against a
   realistic payload, count the bytes, multiply by plausible call counts.

## 5. Report, then cut

Rank findings by bytes; each line names a file, a count, and the edit. Every section of a pushed
file takes one of three verdicts beside its byte count:

- **Inline** stays pushed, and earns it only when a session that never touches the subject is
  still worse off without it.
- **Pointer** is a path in prose, read on demand. The default. It suits detail a task goes looking
  for anyway, and fails silently when the session ignores it.
- **Nested** is a context file in the directory it governs: the right home for anything scoped to
  one part of the tree, and invisible to a harness that does not walk the tree.

Before proposing a move, grep the tree for references to what is moving. A section other files
cite by name needs them re-pointed, and the citation count goes in the report. A cut whose failure
is silent is named as such and left to the user.

Done when every section carries one of the three words.

## 6. Re-measure, in a new session

**The session that made the cuts cannot measure them.** Every pushed source is read once at
session start: an edited agent file, a deleted skill and a changed output style all keep their
old cost for the rest of the run, so a re-measure here reports the before figure twice and calls
the second one after.

Print the exact command and ask the user to run it in a new terminal, then paste `/context` from
the session it opens:

```
cd <absolute path of the working tree you audited> && claude
```

Give the absolute path, resolved with `pwd`, not `.` or a repo-relative one: the audit often runs
in a worktree, and a session started from the wrong tree reads a different set of files.

Report before, after, and the share of the 40k budget. If the after figure is not lower, say that
rather than reporting the plan as the outcome, and name what you expected to move.
