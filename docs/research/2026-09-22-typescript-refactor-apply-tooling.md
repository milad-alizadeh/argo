# TypeScript refactor-apply tooling for AI agents

Date: 2026-09-22

Scope: is there a maintained tool or MCP server, usable by both Claude Code and Codex CLI, that can actually rename a symbol or move a file and rewrite every importer's import specifier, rather than only reporting references?

Prior art: `docs/research/2026-09-20-ai-refactor-path-updates.md` already sourced the tsserver
`GetEditsForFileRename` protocol command, the `ts.LanguageService.getEditsForFileRename()` API,
VS Code's `onWillRenameFiles`/`updateImportsOnFileMove` plumbing, and the
`typescript-language-server` README's workspace commands (file rename, organize imports, raw
`typescript.tsserverRequest`). That file left one question open: does the LSP tool actually
installed in this Claude Code session expose any apply/write command. This session already
confirmed, empirically, that it does not — the tool schema lists only `goToDefinition`,
`findReferences`, `hover`, `documentSymbol`, `workspaceSymbol`, `goToImplementation`, and call
hierarchy. That finding is internal to this session, not a citable URL, and is treated below as
established fact. This file does not re-derive anything from 2026-09-20; it covers ts-morph and
the MCP-server landscape, which that file did not investigate.

## 1. What capability exists today

The mechanism for a real rename/move-with-import-rewrite is the TypeScript language service, not
string search. 2026-09-20 already sourced `GetEditsForFileRename` and
`getEditsForFileRename()`; this file adds the second real mechanism: **ts-morph**, a library (not
a CLI) that wraps the TypeScript compiler API for AST navigation and manipulation. Source:
[ts-morph.com](https://ts-morph.com/).

ts-morph's `Project` is usually constructed from a real `tsconfig.json`
(`new Project({ tsConfigFilePath })`), which is what lets it see every file the compiler would
compile and therefore find every importer. `SourceFile#move()` (and `moveToDirectory()`)
automatically rewrites the module specifiers of relative imports/exports in the moved file *and*
in every other file in the `Project` that references it; `moveImmediately()`/`moveImmediatelySync()`
does the same but writes to disk right away instead of waiting for `project.save()`. Source:
[ts-morph npm package search results citing ts-morph.com/details/source-files and the ts-morph
GitHub](https://www.npmjs.com/package/ts-morph), cross-checked against
[ts-morph.com](https://ts-morph.com/). ts-morph ships no CLI of its own — every use is a Node/TS
script written against the library.

Claude Code's currently-installed LSP tool in this session is read-only, confirmed empirically
this session (not a new finding, restated here for completeness of the capability table): goto
definition, find references, hover, document/workspace symbol, goto implementation, call
hierarchy — no rename, no apply, no file-move command.

## 2. MCP server landscape — searched thoroughly

The official `modelcontextprotocol/servers` repository lists only generic reference servers
(Everything, Fetch, Filesystem, Git, Memory, Sequential Thinking, Time) — nothing TypeScript- or
LSP-refactor-specific; it points to the community registry for anything more specialized. Source:
[modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers).

Four concrete third-party candidates turned up, checked against their own repos and the npm/GitHub
APIs (all dates read 2026-09-22):

| Candidate | Ops exposed | Applies edits or just plans? | Project awareness | Transport | Maintenance signal |
| --- | --- | --- | --- | --- | --- |
| [`isaacphi/mcp-language-server`](https://github.com/isaacphi/mcp-language-server) (Go) | definition, references, diagnostics, hover, `rename_symbol`, `edit_file` | Applies — wraps a real LSP server's rename, including `typescript-language-server` | Whatever the underlying LSP server infers/loads; no ts-morph-style explicit tsconfig project load documented | stdio, generic LSP wrapper (works with gopls, rust-analyzer, pyright, clangd, and typescript-language-server) | 1,596 GitHub stars, 68 open issues, last push 2026-03-01 (~6.5 months stale as of today), not archived |
| [`SiroSuzume/mcp-ts-morph`](https://github.com/SiroSuzume/mcp-ts-morph) (`@sirosuzume/mcp-tsmorph-refactor` on npm) | 8 tools: `rename_symbol_by_tsmorph`, `rename_filesystem_entry_by_tsmorph`, `find_references_by_tsmorph`, `remove_path_alias_by_tsmorph`, `move_symbol_to_file_by_tsmorph`, `change_signature_by_tsmorph`, `get_type_at_position_by_tsmorph`, `find_unused_exports_by_tsmorph` | Applies real file edits (built on ts-morph, not a preview-only mode) | Explicitly tsconfig.json-aware — requires a project path | stdio | 16 GitHub stars, 2 open issues, last push 2026-06-11; npm package published same day, latest version 1.5.3, first published 2025-05-06 (~16 months of continuous releases) |
| [`t09tanaka/ts-rename-helper-mcp`](https://github.com/t09tanaka/ts-rename-helper-mcp) (`@t09tanaka/ts-rename-helper-mcp` on npm) | `planRenameSymbol`, `planFileMove`, `planDirectoryMove` — all via the TypeScript Language Service | Deliberately read-only: returns "edit plans," never writes; a monorepo-aware tsconfig resolver merges edits across multiple `tsconfig.json` files | tsconfig-aware, monorepo-aware | Not stated in repo docs | 0 GitHub stars, 0 open issues, last push 2026-03-22, npm latest 0.1.0 published same day; single-release project |
| [`AndyLiner13/ts-mcp-server`](https://github.com/AndyLiner13/ts-mcp-server) (already found on 2026-09-20) | `renameFileOrDirectory` → tsserver's `getEditsForFileRename-full`, plus a preview mode that "returns changes without applying" | Ambiguous from docs whether default mode writes to disk or only previews | Works without tsconfig via TypeScript's inferred project, but docs say explicit config gives better results | Talks to tsserver over Node IPC, not stdio-to-agent — the MCP-facing transport itself is unconfirmed from the repo page | 3 GitHub stars, 0 open issues, last push 2026-04-07; "beta software" per its own docs |

## 3. Dead ends

`isaacphi/mcp-language-server` is the most starred and best-known of the four, and it does apply a
real rename through whatever LSP server you point it at (including `typescript-language-server`,
the same server 2026-09-20 already vetted). But its rename tool is generic-LSP-shaped, not
TypeScript-project-shaped: it inherits whatever project inference `typescript-language-server`
does on its own, with no explicit tsconfig-aware project load the way ts-morph provides, and its
last push is over six months old relative to today, against 68 open issues — a real but
slow-moving project, not a bleeding-edge one.

`AndyLiner13/ts-mcp-server` (the only candidate 2026-09-20 had already found) turns out to be the
weakest of the four on inspection: 3 stars, "beta software" self-description, an ambiguous
apply-vs-preview default, and a Node-IPC-to-tsserver design whose actual MCP transport to the
calling agent isn't documented on the repo page. It doesn't clear the bar for something to trust
in a real migration.

`t09tanaka/ts-rename-helper-mcp` has a genuinely good idea — plan-only tools that hand a
structured edit plan back to the calling agent, which then applies it — and is monorepo-aware.
But it has zero GitHub stars, a single 0.1.0 release, and 13 commits total: there's no evidence
anyone besides its author has run it. Its plan-only design also just moves the "how do I trust the
apply step" question onto the calling agent, since it explicitly performs no writes itself.

## 4. Plain recommendation

Adopt `@sirosuzume/mcp-tsmorph-refactor` (`SiroSuzume/mcp-ts-morph`) as a project-scoped MCP
server for `apps/desktop`, added the standard way for both CLIs — `claude mcp add --scope project`
(writes to a checked-in `.mcp.json`, so the whole team gets it, Claude Code source:
[code.claude.com/docs/en/mcp](https://code.claude.com/docs/en/mcp)) and `codex mcp add` or a
`[mcp_servers.*]` block in `.codex/config.toml` (Codex source:
[learn.chatgpt.com/docs/extend/mcp](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)). It is
the only candidate that is simultaneously: (a) applies real edits rather than just planning them,
(b) is explicitly tsconfig-aware the way `apps/desktop`'s own `tsconfig.json` needs, (c) is
stdio-based and therefore usable headlessly by a CLI agent with no editor host, and (d) shows a
real, continuing maintenance signal (16 months of npm releases, most recent one three months
before this research, not a single-shot demo). It is small (16 stars) — this is a judgment call on
a young project, not an established one — but it is meaningfully more real than the other three,
and the specific tool set (`rename_filesystem_entry_by_tsmorph`,
`move_symbol_to_file_by_tsmorph`, `rename_symbol_by_tsmorph`) matches the #2637 pain exactly: a
file move that must rewrite every importer, and a symbol rename that must follow it project-wide.

The honest fallback, if that project turns out flaky in a trial run, is not "wrap ts-morph
ourselves" — the two prerequisites 2026-09-20 flagged (a `tsconfig.json`-aware `Project` per
package, and a small set of tools: `rename_symbol_at_position`, `move_file`) are exactly what
`mcp-ts-morph` already ships, tested against real npm downloads and a real commit history. Writing
a first-party equivalent would take a day or two (an MCP server shell around a ts-morph `Project`
per package, one tool per operation, JSON-RPC over stdio) but would start at zero stars, zero
issues filed against it, and zero hours of anyone else having hit its edge cases — strictly worse
than trying the existing one first. Recommendation: **trial `mcp-ts-morph` on the next multi-file
`apps/desktop` restructure, added as a project-scoped MCP server for both CLIs**, rather than
building a bespoke server or continuing pure grep-and-hand-edit. If it proves unreliable in
practice (wrong edits, doesn't resolve `apps/desktop`'s tsconfig paths correctly, or breaks on the
Bun-specific module resolution this repo uses), fall back to the current grep + manual edit +
typecheck method, which is slow but has no correctness risk beyond what the typecheck gate already
catches — do not build a first-party server before a trial of the existing one has actually failed.

This repo's AGENTS.md does not currently document an MCP-server convention anywhere. Per the
"Where things are written down" pattern that file already uses for every other convention (issues,
house rules, domain model, decisions), an MCP adoption would need its own line there — naming
`.mcp.json` as the shared, checked-in surface for Claude Code and `.codex/config.toml` (or a
per-project `.codex/config.toml`, per Codex's own docs) as the Codex equivalent — rather than being
left to install instructions buried in a PR description.

## Limitations

Every maintenance number here (stars, last-push date, npm publish date) is a snapshot read on
2026-09-22 through the GitHub and npm public APIs; none of it is a guarantee the projects stay
maintained. None of the four candidates were run against this repo's actual `apps/desktop`
`tsconfig.json`, Bun module resolution, or a real rename/move — this research is desk research on
public documentation and repo metadata, not a hands-on trial. `mcp-ts-morph`'s own test coverage,
error handling on partial failures (e.g. a rename that only some importers can see because of path
aliases), and behavior under Bun rather than Node were not verified. Before relying on it for a
real migration, run it once on a low-stakes rename in a throwaway worktree and inspect the diff by
hand.
