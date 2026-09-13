# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Labels

Every issue is labelled in the `gh issue create` call. There is no unlabelled issue, and a bug
report is no exception.

- **One triage label, always.** Each label string equals its role name, so a vendored skill
  asking for "the AFK-ready triage label" is asking for `ready-for-agent` verbatim.
  `ready-for-agent` when the
  issue is specified well enough for an AFK agent to build it, `ready-for-human` when a person
  must do the work, `needs-info` when the report is short of a fact only the reporter holds, and
  `needs-triage` when you cannot tell. The fifth, `wontfix`, is a closing label, never a
  create-time one.
- **One kind label when the kind is clear**: `bug` for behaviour that is broken, `enhancement`
  for behaviour that is new, `documentation` for docs, designs and ADRs.
- **Legacy design tickets can carry `stale`.** Before using one as an exact reference, compare it with the current task and app.
  Record the current decisions on the implementation ticket.
  A stale reference does not block ordinary implementation or objective interface review.

You know which triage label fits at the moment you write the body, so the create call is where it
goes. An issue that lands unlabelled falls into `/triage`'s never-triaged bucket, and a person
must read it again to learn what you already knew.

## Screenshots

A screenshot is evidence. It belongs in the tracker, not only in the session.

- When you create an issue from a bug report, put the user's screenshot in the body under a
  `## Screenshot` heading.
- A PR that changes how a screen looks names every changed state, and says where each is seen:
  the Storybook story, or the render command. If the change is a fix, describe the before as well
  as the after.

**An agent attaches the image itself**, through github.com in Chrome, where the user is signed in.
`gh` and the REST API cannot attach a file; the page's upload is the only route, and GitHub hosts
the file on its own CDN, outside the repository.

1. Put the file inside the worktree, untracked. `file_upload` refuses the scratchpad and
   `/var/folders` temp dirs.
2. Open the issue or PR. In the "Add a comment" box, capture GitHub's file input without the native
   picker: with `javascript_tool`, wrap `HTMLInputElement.prototype.click` so a `type=file` input
   is kept rather than clicked, click the "Paste, drop, or click to add files" button, and restore
   the original `click`.
3. `find` the input (the tree shows it as a `type="file"` button) and pass the path to
   `file_upload`.
4. After a few seconds the box holds `<img … src="https://github.com/user-attachments/assets/<id>" />`.
   Copy that tag, empty the box through the native `value` setter plus an `input` event, and put
   the tag in the body with `gh issue edit --body-file`. Delete the local file.

Beside an image, a component's PR still names its Storybook story (CI writes the preview links,
#1953) and a screen's PR its render command and state names, so a reader can draw the current one.

An agent's local captures are **disposable**: a temp dir, judged, deleted. A PNG in a git object
has no version, so a later reader cannot tell whether it shows the code beside it or the code it
replaced. That is why nothing writes `refs/pr-screenshots/*` or `refs/evidence/*` any more (#1910)
and why no workflow uploads a capture. The `refs/evidence/*` commits that already exist stay:
they back images in closed issue bodies, and deleting one 404s a picture in the tracker.

A pasted image is not a file on disk. Ask the user to save it and give you the path.

## Writing a body

`gh` reads a body from `--body`, or from `--body-file` naming a **real file**. `--body-file -`
with a heredoc silently produces an empty body, so write the file first and pass its path.

Everything else is ordinary `gh`. Two things that are not:

- **The labels are not optional**, and they go in the create call — see **Labels** above.
- **GitHub shares one number space across issues and PRs**, so a bare `#42` may be either.
  Resolve with `gh pr view 42` and fall back to `gh issue view 42`.

`gh` infers the repo from the clone it runs in.

**PRs are not a request surface here**, so `/triage` reads issues only.

When a skill says "publish to the issue tracker", create a GitHub issue; when it says "fetch the
relevant ticket", run `gh issue view <number> --comments`.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `gh issue create --label wayfinder:map`.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue (`gh api` on the sub-issues endpoint). Where sub-issues aren't enabled, add the child to a task list in the map body and put `Part of #<map>` at the top of the child body. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: GitHub's **native issue dependencies** — the canonical, UI-visible representation. Add an edge with `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` is the blocker's numeric **database id** (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`, _not_ the `#number` or `node_id`). GitHub reports `issue_dependencies_summary.blocked_by` (open blockers only — the live gate). Where dependencies aren't available, fall back to a `Blocked by: #<n>, #<n>` line at the top of the child body. A ticket is unblocked when every blocker is closed.
- **Frontier query**: list the map's open children (`gh issue list --state open`, scoped to the map's sub-issues / task list), drop any with an open blocker (`issue_dependencies_summary.blocked_by > 0`, or an open issue in the `Blocked by` line) or an assignee; first in map order wins.
- **Claim**: `gh issue edit <n> --add-assignee @me` — the session's first write.
- **Resolve**: `gh issue comment <n> --body "<answer>"`, then `gh issue close <n>`, then append a context pointer (gist + link) to the map's Decisions-so-far.
