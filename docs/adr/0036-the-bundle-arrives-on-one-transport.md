# 0036 · The bundle arrives on one transport, and the app is what asks

Status: accepted, not yet built · 2026-09-09 · built on #1810

> **Where the hooks are today.** At the repository root, in `hooks/`, moved there out of
> `scripts/` so that the guardrails are one directory rather than scattered through a general
> scripts folder. That is not the location this ADR decides, and it is not meant to be: the move
> below is #1810's work and waits on the assumption in **Consequences** being proved first. Until
> then a consumer still copies the hooks by hand, and `setup-argo-skills` still says so.

## Context

Installing Argo's agent setup into a project takes three transports today, and only one of them
is versioned:

| what | how it arrives | recorded in |
|---|---|---|
| skills | `npx skills add milad-alizadeh/argo` | `skills-lock.json` |
| rtk filters | `curl` from `raw.githubusercontent.com/.../main` | nothing |
| hooks | a shallow `git clone`, then copy `hooks.json`, `hooks/` and `docs/agents/worktrees.md` by hand | nothing |

The hooks are the sharpest case: they are not in the published package at all. `hooks/` sits at
the repository root, outside `packages/argo-skills/`, so `skills add` cannot carry them and
`skills update` cannot move them forward. A project can be a version behind on its guardrails
with nothing on disk that says so.

The dependency on the upstream skills is prose. `setup-argo-skills` tells the agent to run
another skill first if `docs/agents/issue-tracker.md` is missing. Nothing records that Argo's
bundle is incomplete without it, so a restore from the lock file restores half the setup.

Underneath both is the trigger problem. Installation happens when a human remembers to invoke a
skill inside a project. Argo the app knows exactly when a project is opened and has a companion
channel into every session it spawns, and uses neither. So the app installs, opens a project, and
behaves worse than it does in this repository, for reasons the user cannot see.

## Decision

**One transport, named in one manifest, triggered by the app.**

1. **The hooks move inside the bundle**, under the skill that installs them:
   `packages/argo-skills/skills/setup-argo-skills/hooks/`. They travel as that skill's own
   assets, so `skills add` delivers them and `skills update` moves them forward. Step 6 copies
   from its own installed directory instead of cloning. The rtk filter assets move the same way.
2. **Dependencies live in the lock file, not in prose.** Argo ships a template
   `skills-lock.json` naming both `milad-alizadeh/argo` and the upstream skills it depends on, so
   `npx skills update --project --yes` restores the whole set.
3. **The app asks on project open.** Argo reads the project's `skills-lock.json`; where the
   bundle is absent or behind, it offers to install, dismissible per project. One click runs the
   same recipe the skill runs.
4. **Hooks stay a separate yes** inside that flow.
5. **Nothing installs at user level.** Skills and hooks land in the project.

## Why

- **A version you cannot read is a version you cannot support.** Two of the three transports
  leave no record, so "which hooks does this project have" is answerable only by reading the
  files and comparing them by eye.
- **Three transports fail independently.** A `curl` against `main` takes whatever `main` holds at
  that second, which is not what the lock file pinned; a clone step that a user skips leaves
  skills whose prose cites hooks that are not there.
- **The trigger is the whole gap the user feels.** Everything else here is tidiness. This is the
  reason the app underdelivers on a fresh project.
- **Asking is not the same as installing.** Writing into someone's repository unasked is not the
  app's call, and a setup nobody remembers to run is not a setup. An offer on open is both.
- **Skills are additive; hooks are coercive.** An uninvoked skill costs its frontmatter. A hook
  changes how every session in that project behaves, and the worktree guard refuses any branch
  outside the project's configured convention. That asymmetry is why the hook opt-in survives.
- **User-level install is the tempting shortcut and it is wrong for hooks.** One install covering
  every project is defensible for skills. For hooks it means the worktree guard polices every
  repository the user opens, including ones with no worktree convention at all.

## Consequences

- `setup-argo-skills` loses its clone step and its `curl` block, and reads its own installed
  directory instead. The skill gets shorter.
- Argo grows a first-run surface per project: detect, offer, install, verify, report.
- Editing a hook still needs a push to `main` before a reinstall sees it, exactly as editing a
  skill does. The hooks inherit the bundle's release cadence, which they did not have before.
- **Unverified, and load-bearing:** that the `skills` CLI copies a skill directory wholesale
  rather than only its `SKILL.md`. The whole decision rests on it. Prove it before building.
- The companion handshake's `instructions` field is how a session learns what it actually got.
  That was already open on #1730; this is the argument for doing it.
