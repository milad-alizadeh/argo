---
name: atlas-write
description: Generate a Project Atlas — a map of a codebase that teaches what each part does and how the parts reach each other, emitted as anchored nodes in a fixed format. Use when someone asks for an atlas, a map or a picture of a repository, or for a written explanation of how a project fits together.
---

# Atlas Write

An atlas teaches a codebase. A reader must finish a node knowing what that part does, and which
other parts it speaks to. The atlas is generated from the code, and regenerated later. Nobody
edits it by hand.

## Gate

Get the root with `git rev-parse --show-toplevel`, and work only inside it.

The code is the only source. A README, a context file or an ADR is evidence when it exists, and
never a precondition. Read no chat log, no ticket and no session record.

Write the output where the repository ignores it. Add the output path to `.git/info/exclude`
first, or use a path the user names.

## 1. Find the real parts

Read the build manifests, then the imports. A part is real when the build declares it, or when a
set of files imports each other and little else.

- Derive nothing from folder depth. A deep folder is not a low level.
- Invent no grouping to make the picture tidy. Twenty parts render as twenty, and the node says
  that the project has twenty.
- Render no empty level. Choose the depth of each branch on its own.

**Done when** every part you name resolves to a directory or a build target that `ls` finds.

## 2. Anchor before you write

Each node carries anchor triples of `[path, line, what is there]`. No anchor, no node.

Open every file you anchor, and read the lines around the anchor. An anchor you did not read is
a guess with a line number on it.

**Done when** every anchor path exists, and the named symbol is on the named line.

## 3. Write a node as four things

Every node, at every depth, renders the same four things, one step down:

1. What is inside it.
2. The edges among those things.
3. The edges that leave it.
4. A paragraph over all of that.

An edge is real when you can point at the call site or the type reference that carries it. Name
what crosses the edge in the reader's words, like "the files that belong here" or "one reading
per pass". An edge with no cargo named is a line, and a line teaches nothing.

Going up keeps what crosses the boundary, and drops what stays inside it. Write the parent
paragraph fresh over that lifted view. Never join the sentences of the children together.

**Done when** each node has all four, and each edge names its cargo.

## 4. Two lengths, plain words

Two prose lengths, `short` and `long`. There is no third.

Write both in Simplified Technical English. Use 25 words per sentence, one topic per paragraph,
six sentences at most, and the active voice. Read every sentence aloud. Use the words the code
uses for its own types and folders.

Say what the part **does** before you say what it is. "It reads the file the agent writes, and
turns each line into a typed event" teaches. "The parsing layer" does not.

**Done when** the longest sentence in the node holds 25 words or fewer.

## 5. Flows and concepts

A **flow** is one path through the code, entry to exit, as an ordered list of steps. Every step
is visible at once, and each step carries its own anchor. A flow has no depth and never nests.

A **concept** is a word the code spells, plus the places that spell it. It drills into its
evidence, and never into smaller concepts.

Each part lists the concepts it spells. That is the only edge between a part and a concept.

**Done when** each flow step and each concept evidence entry resolves to a real line.

## 6. Say what you did not find

Write "there is none" only when a manifest declares it. Everywhere else write "none found", and
name what you looked for.

When the code cannot settle a claim, write the node without that claim, and say so in the report.
Do not fill the gap with a sentence that sounds right.

**Done when** no sentence in the node states a fact you did not read.

## 7. Emit

One JSON file. One object per node, keyed by id:

```json
{
  "id": "read",
  "kind": "part | flow | concept",
  "depth": 1,
  "parent": "argo",
  "name": "Reading the record",
  "line": "One sentence a reader can repeat.",
  "short": ["…"],
  "long": ["…"],
  "inside": ["read-lines"],
  "among": [["read-lines", "read-record", "complete lines"]],
  "leaving": [["read", "join", "typed events, in batches"]],
  "concepts": ["c-session"],
  "steps": [["Title", "Prose", ["path", 12]]],
  "anchors": [["path", 12, "what is there"]],
  "evidence": [["path", 12, "what is there"]],
  "bottom": true,
  "claims": { "leaving": { "sha": "…", "paths": ["…"] } }
}
```

`depth` is a number, never a word. A reader tells a part from a flow from a concept by its shape
and a small legend, so the atlas never spends a word on the level a node sits at.

`claims` records, for each claim, the commit it was written at and the paths it was drawn from.
One commit then marks one sentence stale, and the rest of the node stands.

`bottom` marks a node whose anchors are an exit. That node offers its paths as a jump into the
reader's editor, and says that is what it is doing. Do not descend to one node per file.

**Done when** the file parses, and every id in `inside`, `among`, `leaving` and `concepts` exists
as a key.

## 8. Get it checked

One node at a time, in a context that never saw your reasoning, run `atlas-review`. Claude Code:
the `Agent` tool, one agent per node. Other harnesses: a fresh session over the emitted file.

A node with a `false` claim goes back to step 2. Never argue with the checker from memory. Open
the line it names.

**Done when** every node returns zero `false` rows.

## Report

Give the output path, the node count, the depth of each branch with the reason it stopped there,
the claims you could not settle, and the parts of the repository the atlas does not cover.
