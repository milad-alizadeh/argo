# A Session owns its worktree

Status: accepted · 2026-10-01 · supersedes ADR-0010

## Context

Argo Desktop kept a Workspace registry: one record for each Project's main checkout and each
linked worktree, with its own id, kind and path. Sessions pointed at a Workspace. The registry
was a second copy of what git already lists, and it needed reconciling, a launch sweep and a
restore path when git and the records disagreed. ADR-0010 put this identity on each tree node.
In practice only a Session creates, keeps or removes a worktree, and a Subagent runs in its
Session's folder.

Claude Code already has a worktree rule that people who use both tools know:
<https://code.claude.com/docs/en/worktrees>, section "Clean up worktrees".

## Decision

There is no Workspace entity. A Session has a Project and `0..1` worktree: the `path` of the
linked worktree it runs in, and its `branch`, which is null when the worktree is detached. It does
not matter who made the worktree. A Session that Argo starts in a new worktree and a Session found
in a linked worktree made outside Argo have the same worktree record and follow the same rules. A
Session with no worktree runs in its `cwd`, which is the Project's main checkout for a new Session.
Git is the only list of a Project's checkouts.

The composer of a new Session shows a Worktree row in the tray above the editor:

- The row has a switch labeled "Worktree". The Project remembers the switch. A new Project starts
  with the switch off.
- The branch comes first in the row, and the switch follows it. You can click the label to
  change the switch.
- If the switch is off, the row shows the branch of the main checkout as plain text. The Session
  runs in the main checkout.
- If the switch is on, the branch becomes a dropdown that you can search. It lists the local
  branches. Argo makes a new worktree on a new `argo/session-…` branch, from the branch you chose.
- The dropdown always begins on the current branch of the main checkout. Argo does not remember
  the branch you chose.
- After the first prompt, the row is gone and the switch and branch cannot change. The Session
  header shows the folder of the Session. For a worktree, it also shows "from" and the base
  branch, if the base is not the current branch of the main checkout. Argo stores the base with
  the worktree.
- A new worktree starts at a commit. Uncommitted changes in the main checkout stay there and do
  not go into the new worktree.

There is no choice of an existing linked worktree. To continue the work of a worktree that you
made yourself, start a new worktree from its branch.

Prior art:

- Claude Code Desktop has one worktree checkbox per Session:
  <https://code.claude.com/docs/en/desktop#work-in-parallel-with-sessions>.
- Paseo has an Isolation control with a "Starting ref":
  <https://github.com/getpaseo/paseo/blob/b5b43edd65cc1253493b13cca3941dd390df6ef3/packages/app/src/screens/new-workspace-screen.tsx>.
- Codex asks for a base branch after you choose Worktree:
  <https://learn.chatgpt.com/docs/environments/git-worktrees>.

Argo follows Claude Code's cleanup rule for a Session worktree when its Session is archived:

1. A clean worktree is removed, with its branch. Clean means no changed files and no commits that
   no other branch or remote holds.
2. A worktree that holds work opens a dialog that says what it holds and offers Keep, Remove and
   Cancel.
3. When Argo cannot read the worktree's state, it opens the same dialog and says what it could not
   check. It never removes without asking.
4. Nothing is removed while the Session has a Turn in progress.
5. When a Session's worktree folder is gone at open or resume, the Session continues in the main
   checkout, the person is told, and the worktree is cleared.

Argo never removes the main checkout, the folder the Project was added from, any folder that is
not a Session worktree, or a worktree that another unarchived Session runs in. There is no
launch sweep, no setting, no snapshot, no restore and no cap. Claude and Codex Sessions follow the
same rule.

A Preview still attaches at the tree node, as ADR-0010 set out.

## Consequences

- The migration drops the Workspace table and keeps each Session's folder. A Session in any
  linked worktree, made by Argo or not, gets it as its worktree. The branch of a worktree made
  outside Argo is null until the next Session scan reads it from git.
- Archiving a Session in a worktree made outside Argo can remove that worktree and its branch
  when it is clean, as for any other Session worktree.
- The migration turns the Project's last choice into the switch. The switch is on only when the
  last choice was a new worktree.
- A worktree that a person keeps after archive stays on disk until they remove it.
- A resumed Session whose worktree is gone runs from the main checkout. A Harness that finds its
  history by folder may start that resume without the earlier context.
