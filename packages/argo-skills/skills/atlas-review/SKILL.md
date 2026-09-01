---
name: atlas-review
description: Fact-check a generated Project Atlas against the code it describes, marking each claim true, false or cannot-tell with a path and a line. Use after atlas-write emits a node, or when someone asks whether an atlas, a codebase map or generated architecture prose is still accurate.
---

# Atlas Review

An atlas is prose about code, so a reader cannot see what it left out or made up. This skill
opens the code and settles each sentence.

## Gate

Run this in a context that never saw the atlas being written. A writer that grades its own output
grades its intent. If you wrote the node, stop and say so.

Your inputs are the emitted node and the repository. Not the diff, not the reasoning, and not the
ticket that asked for it.

Get the root with `git rev-parse --show-toplevel`.

## 1. Split the node into claims

A claim is one assertion a reader could act on. Split the whole node, not the fields you find
easy:

| Field | One claim each |
|---|---|
| `line`, `short`, `long` | Every sentence that states a fact about the code. |
| `inside` | Each child, and the assertion that the list is complete. |
| `among`, `leaving` | Each edge, and the cargo named on it. |
| `concepts` | Each concept the part is said to spell. |
| `anchors`, `evidence`, `steps` | Each triple. |
| `bottom` | That there is nothing worth a level below. |

**Done when** the claim count is written down, and each claim is one sentence long.

## 2. Resolve every anchor

For each anchor, open the file and read the named line.

- The path is gone → `false`. Say so.
- The line no longer holds the named thing → `false`. Say what is there now.
- The path exists, and the symbol moved within the file → `false`, with the new line.

**Done when** every anchor has been opened. A path you did not open is `cannot tell`, never
`true`.

## 3. Settle each relation

An edge claim is `true` only when you can point at the call site, the import or the type
reference that carries it. A name that appears in both places is not an edge.

Read the direction as well. An edge that runs the other way is `false`, not a detail.

**Done when** each edge row carries a `path:line` for the thing that crosses it.

## 4. Settle each prose sentence

Read the code the sentence describes, then ask one question: does a reader who believes this
sentence hold a true picture?

- The sentence says less than the truth → `false`, and name what it leaves out. A part that
  writes as well as reads, described as read-only, is wrong even though every word is true.
- The sentence describes what the code once did → `false`, with the commit or the line that
  changed it.
- The code cannot settle it → `cannot tell`, and say what evidence would.

**Done when** each sentence has a verdict and a path.

## 5. Find what is missing

Walk the directory the node covers. List anything real and substantial that the node never
mentions, and say how large it is.

Omission is the failure an atlas hides best, so give it its own pass rather than folding it into
step 4.

**Done when** every child directory of the node's own path is either mentioned in the node, or
named in your omission list.

## 6. Report

One markdown table, sorted so `false` rows come first, then `cannot tell`, then `true`:

| node | claim | verdict | evidence |
|---|---|---|---|

Then the omission list, then one line giving the claim count and the false count.

Fix nothing, and write no file. A `false` row is the writer's work, and a checker that edits the
node stops being an independent reading of it.
