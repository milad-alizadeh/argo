---
name: setup-argo-skills
description: Bootstrap a project. Installs the skill bundle, then a wizard that dispatches each chosen piece of infra to its setup skill.
disable-model-invocation: true
---

# Setup Argo Skills

**This skill writes the project's agent docs, so it answers to them.** Every document it drafts
or edits — an `AGENTS.md` section, a `docs/` page, a template resolved into place — goes through
the `writing-for-agents` skill first, and every line it puts in front of the user goes through
`simple-english`. Neither ships in this bundle: they come from `mattpocock/skills` and
`AminBlg/SimpleEnglish`. Check for each before Phase 2, offer to add the one that is missing, and
say in the Phase 4 report which pass you could not run.

## Phase 1: install the skill bundle

In this order, using the stock `skills` CLI and ordinary shell. Steps 5 and 6 read files out of
the Argo repo itself, so fetch what they need with `curl` or a shallow clone when you reach
them.

### 1. Rescue the skills this repo already owns

`skills add` publishes a skill by replacing `<agent>/skills/<name>/` with a symlink into its
vendored payload, so a directory the project already had under that name is deleted. Tracked in
git is what separates the two populations: vendored payload lands in ignored directories, so
anything git knows about under a skills directory is the project's own.

Snapshot that set **before** installing:

```sh
git ls-files -z -- .claude/skills .agents/skills .cursor/skills .codex/skills > /tmp/owned-skills
```

After the install (step 2 or 3), restore every snapshotted path that is now missing. When an
ancestor directory has become a symlink, `rm` that link first: a checkout through it writes into
the vendored payload instead of the repo. Then `git checkout -- <path>`, which recovers the
version in the index.

Name every restored file to the user, loudly. The bundle ships a skill under the same name and
theirs won by default, so they must rename one of the two and re-run. A silent restore leaves
them believing the collision never happened, and the next `skills add` finds the same trap.

Outside a git repo, skip this step. There is no way to tell the two populations apart there, and
guessing restores files the project never had.

### 2. First install

Ask the **user** to run this from the project root, interactively:

```sh
npx skills@latest add milad-alizadeh/argo
```

They answer two wizard questions. At "Which agents do you want to install to?" they pick
`claude-code` plus at least one universal agent (`codex`, `cursor`). At "Installation method"
they pick Symlink, the recommended one. That pairing is what makes the CLI build
`.claude/skills/<name> -> ../../.agents/skills/<name>` itself.

Interactive matters. The method question is asked only when the chosen agents span more than one
skills directory: agents that all share one directory get copy mode silently and Claude Code gets
nothing, and `--yes` suppresses the question the same way. So this run is interactive and spans
both directories, or Claude Code ends up with no skills.

### 3. Repeat run, and update

A project that already has a `skills-lock.json` updates instead of installing:

```sh
npx skills update --project --yes
```

It reads the installed agent set off disk (it prints, for example, `Updating for: Universal,
Claude Code`), so `--yes` is safe here where it is not in step 2: a fresh non-interactive install
drops Claude Code, an update cannot. It fetches the latest upstream content, not a pinned
revision. A lock entry may carry a `ref` field, Argo's entries carry none, so the default branch
is what resolves. `computedHash` is drift detection, not a pin.

### 4. Prune what Argo deleted upstream

Nothing removes a skill that has left the bundle, so it stays installed forever. List what the
repo publishes now, and what the project's lock still holds from it:

```sh
gh api repos/milad-alizadeh/argo/contents/packages/argo-skills/skills --jq '.[].name'
jq -r '.skills | to_entries[]
  | select(.value.source == "milad-alizadeh/argo") | .key' skills-lock.json
```

Remove the names in the second list that are absent from the first:
`npx skills remove -s <names>`. Report which ones went and why.

### 5. Seed the rtk filters

Give the project `.rtk/filters.toml` from Argo's template, and keep any existing file untouched:
the consumer owns it after the first copy, and a re-run must not clobber filters they have edited
and re-trusted.

The template is a core file carrying the format rules and no filters, plus one sidecar per
toolchain. Copy the core, then append **only** the sidecars whose toolchain the project actually
has: a filter for a command the project never runs is dead weight nobody ever deletes.

| sidecar | append when |
| --- | --- |
| `rtk-filters.swift.toml` | a `Package.swift` exists |
| `rtk-filters.bun.toml` | a `bun.lock` exists |

```sh
base=https://raw.githubusercontent.com/milad-alizadeh/argo/main/packages/argo-skills/assets
if [ ! -f .rtk/filters.toml ]; then
  mkdir -p .rtk
  curl -fsSL "$base/rtk-filters.toml" -o .rtk/filters.toml
  test -f Package.swift && curl -fsSL "$base/rtk-filters.swift.toml" >> .rtk/filters.toml
  test -f bun.lock && curl -fsSL "$base/rtk-filters.bun.toml" >> .rtk/filters.toml
fi
```

Where the project's build or test command is noisy and has no sidecar here, say so in the report
rather than writing a filter blind: a filter is only trustworthy once a fixture longer than its
own cap proves it does not eat the errors, and that fixture comes from a real run.

Tell the user the filters do nothing until they run `rtk trust --yes`, once per checkout and
again after every edit. This is seeded on every install, not gated on the opt-in below, because
an untrusted filter file changes no behaviour.

### 6. Guardrail hooks, only when the user opts in

The hooks impose a worktree discipline (one guard covering both where a change runs and what the
worktree is named, plus the worktree reaper) on the project, and one that reserves pushing a work
branch and opening a PR to `/ship`. Ask first and install nothing unless the answer is yes.

Clone Argo shallowly, then copy these into the project's **git root**, keeping their paths.
The git root, not the working directory: the projected commands resolve their scripts through
`git rev-parse --show-toplevel`.

| From the Argo clone | Why it is in the set |
|---|---|
| `hooks.json` | the neutral descriptor every projection is generated from |
| the whole `hooks/` directory | every script the projected commands invoke, and nothing else: it holds only these hooks, so it is copied wholesale rather than picked over |
| `docs/agents/worktrees.md` | the contract the deny message cites, and only when you set `worktreeGuard.docs` to point at it. A project that keeps its own convention document names that instead, and one that has no convention copies no doc |

The set is lockstep with `hooks.json`: a command added there whose script is missing here
projects a hook pointing at nothing.

**Then set the project's convention in `hooks.json` before projecting anything.** The hooks
carry none of their own, and the defaults are deliberately quiet rather than Argo's:

| key | what it does | leave unset when |
|---|---|---|
| `worktreeGuard.roots` | narrows the edit guard, whose default is the whole repository | the whole repository is right |
| `worktreeGuard.dir` | where worktrees live; defaults to `.claude/worktrees` | that default suits |
| `worktreeGuard.branchPrefix` | turns branch-name checking ON, e.g. `argo/` | **the project has no branch convention. Unset, the guard judges no branch name at all, which is the right default: a guard that invented a convention would refuse every name the project already uses** |
| `worktreeGuard.docs` | the path a refusal cites for the full rules | there is no such document; the refusal then cites nothing rather than a file the project does not have |
| `worktreeGc.artifactPaths` | glob patterns, relative to each worktree, that the `--artifacts` sweep deletes | the project has no build output to sweep. Unset, that sweep finds nothing and says so, rather than reporting a clean zero |

Read the project's own layout before filling these in. Copying Argo's values into a project that
does not share them is the failure this table exists to prevent.

Then project the descriptor per agent, from the project root:

```sh
node <argo-clone>/packages/argo-skills/bin/hooks-sync.mjs
```

It regenerates `.claude/settings.json` and `.codex/hooks.json`. Those blocks are generated, so
every later change goes into `hooks.json` and through this command again.

### 7. Ignore the payload, unless the repo commits its skills

The install writes about a megabyte of vendored payload plus a symlink farm per harness, none of
it the consumer's work and none of it theirs to review. Left out of `.gitignore` it lands as a
wall of untracked files on their next `git status`, so add:

```
.claude/skills/
.agents/skills/
.cursor/skills/
.codex/skills/
```

Add them **only when the step 1 snapshot came back empty**. A repo that deliberately commits its
skills has no such line, and that is exactly the state a naive check reads as permission to add
one, hiding every file they add there afterwards. Scope the lines to the skills subdirectory:
`.agents/` alone would also swallow a consumer's own `.agents/rules/`.

Done when the lock delta, any restored owned skills and the pruned names are all in hand for the
Phase 4 report. The bundle's always-on cost is not counted here: `audit-agent-docs` prices skill
frontmatter as one of its five costs, and Phase 2 dispatches it last for exactly that reason.

## Phase 2: the infra wizard

Detect first (language, UI, monorepo, hooks and CI, linter) so every question ships a
recommendation, then ask one grouped multi-select question with the recommendation marked:

| Choice | Delegates to | Recommend when | Order |
|---|---|---|---|
| Quality gates as errors, plus the one-page prose residue | `setup-quality-gates` | always | 1 |
| Always-on task tracking | this skill, below | always | 2 |
| Guardrail hooks | Phase 1, step 6 | user runs git worktrees | 3 |
| Price and cut the agent docs | `audit-agent-docs` | always | last, since every step above adds to the bill |

Done when the user has answered the one question.

## Phase 3: dispatch in order

Run each chosen skill as a skill; each owns its own detection and wizard. Between steps,
report one line: what was installed, what was deferred.

The following sections are templates, appended to the project doc that
exists (`AGENTS.md`; `CLAUDE.md` too only if it does not merely import `AGENTS.md`), replacing
any section of the same heading in place.

| template | install when | how |
|---|---|---|
| `templates/task-tracking.md` | always | verbatim, naming only the harnesses this project uses |
| `templates/subagent-models.md` | the project's harness lets a dispatch choose a model | verbatim; where it cannot, the section is a no-op and is skipped |
| `templates/writing-style.md` | always | verbatim, minus any paragraph naming a skill the project has not installed: a rule pointing at a missing skill teaches a reader to ignore the section |
| `templates/labels.md` | `docs/agents/issue-tracker.md` exists | **resolved, never verbatim** (below) |
| `templates/screenshots.md` | `docs/agents/issue-tracker.md` exists | verbatim on GitHub; elsewhere append the two bullets and stop, since the rest is the GitHub publish method |

`docs/agents/issue-tracker.md` is written by `setup-matt-pocock-skills`, a vendored skill this
project cannot edit in place, which is why these ride here instead.

**Labels carries `{{...}}` placeholders and no project's real label names.** Read the project's
own set first (`gh label list`, the host's equivalent, or ask), and resolve every placeholder to
a label that exists there. What travels is the shape, one triage label and one kind label, both
applied in the create call. A tracker using `P1`/`P2`, or Linear states, gets labels that do not
exist if the file is pasted unchanged, and creating an issue with a label the host does not know
is an error, not a warning. Where the tracker has no label for a role, drop that clause rather
than invent one; where no tracker is detected, skip the section.

Done when the installed Labels section has zero hits for `{{`.

### Connect interface review

When the project has UI and `interface-review` is installed, read `templates/ui-workflow.md`.
Install its `UI work` section in `docs/agents/code-review.md`, replacing that section on repeat runs.
Preserve the document's other sections. Create the document if it is absent.
Add a pointer in `AGENTS.md` to read that section for UI work.
Update `CLAUDE.md` only when it carries independent instructions rather than importing `AGENTS.md`.

Keep the installed review and implementation skills unchanged.
Done when UI work reaches the third review axis and non-UI work retains the existing route.

## Phase 4: report

Skills installed or updated (lock delta), infra installed per piece, anything deferred with
the reason, and how to re-run each selected skill by its actual name.
For UI work, point to the installed section in `docs/agents/code-review.md`.
