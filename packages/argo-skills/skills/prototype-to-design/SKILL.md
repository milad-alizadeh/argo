---
name: prototype-to-design
description: Approve one prototype variant as the design, once per screen, before any code. Use when the user picks a variant ("go with the second one"), asks for a design to be approved, or asks what to do with a finished prototype.
---

# Prototype To Design

`/prototype` explores. This approves one of what it explored and splits the result by lifetime:
the **durable** half is a design ticket carrying the measurements, and the **throwaway** half is
an HTML page speaking only the token contract, alone on its own branch. `design-to-code` then
runs once per ticket against both.

**Nothing lands on `main`.** A design file on `main` is a live file with an owner: it goes on
being edited long after the screen it describes has shipped, and it drifts from the ticket that
asked for the screen and from the page that shows it. Two copies can be kept in step by deleting
one of them on a known day. Three cannot.

A prototype settles one of two things. Unsettled *behaviour* ("does this state model work?")
goes `/prototype` → `/handoff` → `/to-spec`, and never through here. Unsettled *appearance*
("what should this screen look like?") goes `/prototype` → here → `/to-spec` → `/to-tickets`
→ `/design-to-code` per ticket → `/pixel-review`, because a UI prototype's decision is a set
of measurements and prose loses every one of them. Both: the behaviour prototype first, cheap
and throwaway, then the appearance route.

## Gate

Needs a prototype whose variant is agreed. If the user has not picked one, stop and ask. If
the token contract is missing a whole family the prototype uses (no typography roles, no
spacing steps), stop and ask the user to run `/setup-design-infra` (phase B) with the prototype
as raw material, then come back.

## 1. Drop the losing variants

Delete the other variants, the switcher and their URL plumbing. Keep every state reachable
by URL: error, empty and loading are what `design-to-code` extracts against and what
`pixel-review` judges. Note what the prototype learned that the render will not show (a fact
the data exposed, a case that overflowed) for the ticket in step 4.

Done when the file renders only the agreed variant and every state is reachable by URL.

## 2. Dump every raw value

Per family (colours, font sizes, spacing, radii, durations), one list of distinct values,
including values inherited from a hand-written stylesheet.

Done when every family has a list and no value in the page is missing from one.

## 3. Snap or promote, nothing stays raw

For each distinct value, exactly one of:

- **Snap** to the nearest existing token. Exploration jitter collapses here and the token
  keeps its clean value.
- **Promote** to a new token, named by role (`--text-label`, not `--text-10-5`). Typography
  roles are full tuples: size, line-height, weight, tracking.

Show the user the snap/promote table before proceeding; a promotion is a contract change and
lands with its framework wiring in every theme variant.

Done when the user has seen the table and every raw value has a verdict.

## 4. Open the design ticket

The durable half is a ticket. Open it with the `documentation` kind label, titled for the
screen, carrying:

- **every measurement this screen settled** — the numbers themselves, not a pointer to the page
  that draws them;
- **the snap/promote table**, and any token that reached the contract;
- **what the prototype exposed that a render will not show**: a fact the data revealed, a case
  that overflowed.

Its number is `<N>` for the rest of this skill, and **every build ticket for this screen is
opened as a sub-issue of it**. That makes the design ticket the index of its own build set, and
it is how `design-to-code` step 6 answers "was this the last one?" — by asking the tracker rather
than by anyone remembering.

**The ticket's own state is the design's state**, so nothing has to be written down twice: open
means agreed and not yet fully built, closed means the screen shipped and the branch is free to
go. The one state the tracker cannot express is **stale** — the app changed this screen without
coming through here — and that is a `stale` label on the ticket. A stale design is re-based
before it is edited: screenshot the shipped screen, correct the design to match, then explore.
**Remove the label in the same change that lands the re-base.** Nothing else removes it, and
every build ticket against this design waits at `design-to-code` step 1 until it is gone.

Done when the ticket exists and a reader who cannot open the page could still build from it.

## 5. Put the page on its own branch

Move the winner to `design.html` at the root of a branch named `design/#<N>-<screen>`, built
from the design template and token mirror the project's design stack names
(`design-template.html` and `tokens.css` by default):

- every value via `var(--token)` or a role class;
- every meaningful region carries `data-component="PascalCaseName"`;
- repeated shapes call a named render function from the project's kit.

**`design.html` is self-contained**: inline the token mirror and the kit into it rather than
linking them as siblings. Both readers of this branch pull that one file out and open it over
`file://`, where a `<link>` or `<script src>` to a sibling is a silent 404 and the page renders
untokenised — which `pixel-review` then judges as if it were the design.

Push that branch holding `design.html` alone. A real branch, not a ref outside the branch
namespace: a branch shows in the code host's UI, it clones, and `git switch` reaches it, where a
bare ref wants a hand-written fetch refspec before anyone can read the design. The push is exempt
from the guard that reserves pushing to `/ship`, because a design branch joins to no ticket and
never merges.

**The number in the branch name is what reaps it.** The sweep reads `#<N>` off the name and drops
the branch once that ticket closes, so the name carries its own expiry and no file anywhere has
to remember this branch exists.

Done when the branch is pushed, the no-raw-values check passes on `design.html`, and every
region has a `data-component`.

## 6. Freeze the names and the renders onto the ticket

Two things now exist only in the page, and both belong on the durable half before the page can
be thrown away:

- **The component names.** Copy every `data-component` value onto the ticket. They become
  component files and ticket titles, and they are frozen from here.
- **The state renders.** Screenshot the page per the project's render method, one PNG per state,
  and attach them under a `## States` heading using the project's durable evidence namespace
  (`refs/evidence/issue-<N>`, per its issue conventions). Say which commit on the branch each
  render came from: a render nobody can tie to a version of the page is a picture, not a spec.

Done when the ticket carries every frozen name, one PNG per state, and the commit they were
taken from.

## 7. Report

- The snap/promote table, and any token that reached the contract.
- The design ticket number, and the branch holding its page.
- The measurements the build tickets must carry.
- What the prototype exposed that the render does not show.
- The next step: `/to-tickets`, then `design-to-code` per ticket.
