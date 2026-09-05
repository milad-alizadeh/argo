---
name: setup-argo-skills
description: Bootstrap a project. Installs the skill bundle, then a wizard that dispatches each chosen piece of infra to its setup skill.
disable-model-invocation: true
---

# Setup Argo Skills

## Phase 1: install the skill bundle

Run `npx github:milad-alizadeh/argo` from the project root (`--dry-run` previews, `--help`
lists the flags). If the project already has a `skills-lock.json`, this is an update: say so
and continue.

Done when the scaffolder exits 0 and the lock delta is in the report.

## Phase 2: the infra wizard

Detect first (language, UI, monorepo, hooks and CI, linter) so every question ships a
recommendation, then ask one grouped multi-select question with the recommendation marked:

| Choice | Delegates to | Recommend when | Order |
|---|---|---|---|
| Quality gates as errors, plus the one-page prose residue | `setup-quality-gates` | always | 1 |
| Design infra and the token values | `setup-design-infra` | project has UI | 2 |
| Always-on task tracking | this skill, below | always | 3 |
| Guardrail hooks | scaffolder `--hooks` | user runs git worktrees | 4 |
| Audit what every session loads | `audit-agent-context` | always | last, since every step above adds to the bill |

Done when the user has answered the one question.

## Phase 3: dispatch in order

Run each chosen skill as a skill; each owns its own detection and wizard. Between steps,
report one line: what was installed, what was deferred.

**Task tracking** is a section, not a skill. Append it verbatim to the project doc that exists
(`AGENTS.md`; `CLAUDE.md` too only if it does not merely import `AGENTS.md`), naming only the
harnesses this project uses, replacing any existing `## Task tracking` section in place:

```markdown
## Task tracking

Maintain a live to-do list for any task with **three or more distinct steps**, edits across
**multiple files**, or **a plan the user approved**. Claude Code: `TaskCreate` one call per item,
then `TaskUpdate` for each status change — both are deferred, so load them once with
`ToolSearch("select:TaskCreate,TaskUpdate")` before the first edit. Codex: `update_plan`.

- Write the list **before the first edit**, not as a retrospective summary.
- Exactly **one** item `in_progress` at a time; mark it `completed` the moment it is done.
- Work the items **in the order the list gives them**, and mark an item `in_progress` **before**
  starting it. If the real order turns out to be different, reorder rather than skip an item.
- One item = one verifiable outcome. "Fix the bug" is a task; "read the file" is not.
- Keep single-step edits, lookups, and conversational turns off the list.
- **Split the verification tail into one item each**: the gates, the test suite, the render, the
  code review, the review fixes, the PR. Only the ones the change needs, never two folded
  together — a subject that comma-lists what it covers is the shape to reject.
- **The list runs to the open PR**, so the last item completes when the session does.
```

**Issue writing style** is a section, not a skill, and only applies when `docs/agents/issue-tracker.md`
exists (written by `setup-matt-pocock-skills`, a vendored skill this project cannot edit in
place). If that file exists, append this section verbatim, replacing any existing `## Writing
style` section in place:

```markdown
## Writing style

Before you create an issue, edit an issue body, or write a comment, run the `simple-english`
skill on the title and body text. Do this every time, not only when the text reads badly —
apply it before the first draft goes out, not as a later cleanup pass.
```

**Labels** is a section too, under the same condition: only when `docs/agents/issue-tracker.md`
exists. Append it verbatim, replacing any existing `## Labels` section in place. The first bullet
names four of the five triage labels that `docs/agents/triage-labels.md` maps, and
`setup-matt-pocock-skills` is what writes that file — so if it is absent, run that skill first, or
replace those names with whatever the host tracker uses.

```markdown
## Labels

Every issue is labelled in the `gh issue create` call. There is no unlabelled issue, and a bug
report is no exception.

- **One triage label, always**, from `docs/agents/triage-labels.md`: `ready-for-agent` when the
  issue is specified well enough for an AFK agent to build it, `ready-for-human` when a person
  must do the work, `needs-info` when the report is short of a fact only the reporter holds, and
  `needs-triage` when you cannot tell. The fifth, `wontfix`, is a closing label, never a
  create-time one.
- **One kind label when the kind is clear**: `bug` for behaviour that is broken, `enhancement`
  for behaviour that is new, `documentation` for docs, designs and ADRs.

You know which triage label fits at the moment you write the body, so the create call is where it
goes. An issue that lands unlabelled falls into `/triage`'s never-triaged bucket, and a person
must read it again to learn what you already knew.
```

**Screenshot evidence** is a section too, under the same condition: only when
`docs/agents/issue-tracker.md` exists. Append it verbatim, replacing any existing
`## Screenshots` section in place. The block is GitHub. If the code host is not GitHub, append
the two bullets only and stop; the rest of the block is the GitHub publish method.

````markdown
## Screenshots

A screenshot is evidence. It belongs in the tracker, not only in the session.

- When you create an issue from a bug report, put the user's screenshot in the body under a
  `## Screenshot` heading.
- A PR that changes how a screen looks carries one screenshot per changed state. If the change
  is a fix, carry the before image and the after image.

`gh issue` and `gh pr` cannot attach a file. Publish the PNGs to a ref instead. Run this in the
repo, with `shots` set to the directory that holds them:

```sh
shots=<dir>
ref=refs/evidence/issue-<N>          # a PR instead: refs/pr-screenshots/<head branch, / as ->
tree=$(for f in "$shots"/*.png; do
  printf '100644 blob %s\t%s\n' "$(git hash-object -w "$f")" "$(basename "$f")"
done | git mktree)
commit=$(git commit-tree "$tree" -m "evidence: $ref")
git push --force origin "$commit:$ref"
```

Give every PNG a URL-safe name. An empty `$shots` writes the empty tree and pushes nothing you
can link to, so make sure that the glob matched.

Embed each one by a raw URL pinned to that commit:

```markdown
![empty state](https://raw.githubusercontent.com/<owner>/<repo>/<commit>/empty-state.png)
```

The commit sits on no branch, so it never merges. The ref is the only thing that keeps the
image reachable: while the ref lives, the URL resolves; delete the ref and the image goes 404.
A PR screenshot is review-time evidence and its ref can go once the PR closes. An issue
screenshot must outlive the issue, so leave `refs/evidence/*` alone.

The raw URL renders on a public repo only. On a private repo, ask the user to drag the file
into the body on github.com.

You cannot read a pasted image as a file. Ask the user to save it and give you the path.
````

## Phase 4: report

Skills installed or updated (lock delta), infra installed per piece, anything deferred with
the reason, and how to re-run any single piece (`/setup-<piece>`). If design infra was
installed, the next step is `/prototype` on the first screen.
