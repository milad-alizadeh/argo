# Argo

Monorepo for the Argo skills/plugin **and** the Argo cockpit app. The cockpit is mid-migration:
`apps/macOS` is the deprecated Swift app, kept for reference, and `apps/desktop` is the Electron
replacement being built on #1730. Read by both Claude Code and Codex.

Everything here is a fact about this repository. Process belongs to the skill that owns it.

## Where things are written down

- **Issues and PRDs** — GitHub Issues on `milad-alizadeh/argo`, via `gh`. A screenshot goes in
  the issue body, and in the PR body when a screen changes. `docs/agents/issue-tracker.md`.
- **Triage labels** — five canonical roles, each label string equal to its name, applied in the
  `gh issue create` call and never afterwards. `docs/agents/triage-labels.md`.
- **House engineering rules** — `rules/`. **Nothing loads these for you.** Before your first
  edit, read the one whose `paths:` frontmatter matches what you are about to touch: `house.md`
  matches everything, `swift.md` only `apps/macOS/**/*.swift`. The arithmetic behind them is
  `biome.jsonc`, not prose.
- **Domain model** — `docs/domain/`, indexed by `CONTEXT.md`. Nothing loads it. Read the one
  section you need before naming or changing a term, and use its words rather than a synonym.
  Code comments cite it as `CONTEXT.md L1 · Binding`. Change a term only after
  `docs/domain/rationale.md`.
- **Before editing any file an agent reads**, including this one: `/writing-for-agents`.

## Gates

**CI is the only gate**, and there is no push-time one. `.github/workflows/ci.yml` runs biome, the
duplication gate on Linux; a `macos-26` job packages `apps/desktop`,
asserts the packaged `node-pty` and runs the shipped app (#1769) when the PR touches
`apps/desktop`, the root manifest, the lockfile or `.github/`. `quality` is biome **plus** the
duplication gate; biome alone leaves a duplication breach for CI.

When a gate fires, fix it or ratchet it in `biome.jsonc`: **never suppress inline, never raise a
global cap.** Both configs fail open when commented, so no gate is proved by exit code alone.

**Node is pinned to `.node-version` exactly**, and `scripts/node-version-gate.mjs` refuses any
other from the root `preinstall` and from `bun run quality:node` (#1800). After switching Node,
delete `node_modules` and reinstall: `node-pty` is a native addon bound to the ABI. A workflow or
composite action reads `node-version-file: .node-version`, and nothing now checks that: the test
that failed on a literal version anywhere went with the hook suite, so a hard-coded version in a
workflow is caught by review or not at all.

**`apps/macOS` is deprecated and verified by nothing.** No build, test, screenshot or render. A
Swift change says in the PR body that it was checked by hand, or not at all.

**macOS runners are free** on public repos, `argo` included (#1758). The "99% of the Actions
spend" figure that removed a `macos-26` job read the gross column; billed is $0. Never quote it.
The real limits: 5 concurrent macOS jobs on GitHub Free, and no secrets on a fork PR.

## Landing

**Pushing a work branch and opening the PR are `/ship`'s step** (#1669): it carries the close-out
nothing else runs, so every other run ends at the reviewed diff, committed on its branch. `/ship`
is invocable by an agent as well as typed, and the review is still its precondition, not its job. A `PreToolUse` hook denies both commands, and it cannot tell which skill
is running, so `/ship` claims the exemption by prefixing its own commands with `ARGO_SHIP=1`.

**Merging is the human's** (#1577). Nothing here does it for them.

## Session isolation

**Every** change runs in a worktree under `.claude/worktrees/`, never in the shared main
checkout, a doc or config fix as much as a ticket build. From the repo root, unprompted:

```bash
git worktree add -b 'argo/#<N>-<slug>' .claude/worktrees/ticket-<N>-<slug>
```

then `EnterWorktree { path: ".claude/worktrees/ticket-<N>-<slug>" }`, or `cd` into it elsewhere.
**`EnterWorktree` creates no tree here: every call without a `path` is refused.** It names the
branch `worktree-<name>` and its `name` cannot hold a `#`, so no tree it creates reaches
`argo/#<N>-<slug>` and `/ship` cannot write `Closes #<N>` off one (#1684).

Only read-only work may stay in the main checkout, and only while it stays read-only. A write
through `Bash` counts as a change; the guard reads those too. Naming, resuming, recovery and the
sub-agent rule: `docs/agents/worktrees.md`.

## Cross-CLI guardrail hooks

`hooks.json` (repo root) is the neutral SSOT for the four cross-CLI hooks, projected per-harness.
**Edit `hooks.json`, then run `bun run hooks:sync`**, which regenerates `.claude/settings.json`
and `.codex/hooks.json`; never hand-edit those blocks. The hooks carry no convention of their own:
this repo's live in the same file, under `worktreeGuard` (`roots`, `dir`, `branchPrefix`, `docs`)
and `worktreeGc.artifactPaths`. **Unset `branchPrefix` and the guard stops judging branch names
at all**, which is what a consumer who has declared no convention gets. A consumer opts in by
hand, and `setup-argo-skills` carries the steps.

## Skill bundle

`skills-lock.json` is the bundle manifest and this repo's install record.

**Install with `npx skills@latest add milad-alizadeh/argo`, and answer its questions.** The CLI
asks which agents, then "Installation method"; picking claude-code alongside a universal agent
such as codex is what makes it write `.claude/skills/<name> -> ../../.agents/skills/<name>`
itself. It asks only when the chosen agents span more than one skills directory, and `--yes`
suppresses the question, so a `--yes` install leaves Claude Code with nothing. **Update with
`npx skills update --project --yes`**, which reads the installed agent set off disk and so keeps
Claude Code, and takes latest rather than a revision because Argo's lock entries carry no `ref`.

`skills add` only adds, so renaming or deleting a skill means deleting the installed copy by
hand, and editing one of Argo's own skills needs a push to `main` before a reinstall sees it.
Add/sweep workflow: `packages/argo-skills/README.md`.

## Design work

**Nothing takes the design route today** (#1758): every design in `docs/designs/` is for
`apps/macOS`. It is written down for `apps/desktop`, which will need its own designs and its own
renderer. When it does, a UI ticket whose screen has a design there is built with
`design-to-code`, because which tickets take that route depends on what is in `docs/designs/`
and no portable skill can know that.

**The design `.md` is on `main`; its explorable `.html` never is** (#1526). The page lives on the
branch the `.md`'s front matter names, `explorable: design/<screen>`, and is read without a
checkout with `git show design/<screen>:docs/designs/<screen>.html`. `explorable: gone` means the
screen shipped and the branch was deleted. So a listing showing no page is the rule working, not
a design that is missing.

## Visual verification

**There is nothing to render right now** (#1758), and `docs/agents/visual-verification.md`
describes commands that no longer exist. Choosing `apps/desktop`'s rendering route is open work.

One rule outlives the tooling: **an e2e run holds the real keyboard and mouse for its whole
length, so say so and wait before starting one.**

## Tooling (RTK)

**Always prefix shell commands with `rtk`** so output is filtered before it reaches context. The
global hook auto-wraps `git`, `grep`, `gh`, `ls` and `find`, and `.rtk/filters.toml` covers this
repo's noisy entrypoints. Two silent traps: rtk reads that file from the working directory only,
so a new run location needs a `.rtk` symlink back to the root, and the filters are inert until
`rtk trust --yes`, re-run per checkout and after any edit. A review's input diff must be
complete: `RTK_DISABLED=1 git diff`. Why: `docs/agents/rtk-filters.md`.

## Writing style

Before you create an issue, edit an issue body, or write a comment, run the `simple-english`
skill on the title and body text. Do this every time, not only when the text reads badly —
apply it before the first draft goes out, not as a later cleanup pass.

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

No work branch and no pull request is involved in that push, so the `PreToolUse` guard that
reserves both for `/ship` does not apply to it.

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
