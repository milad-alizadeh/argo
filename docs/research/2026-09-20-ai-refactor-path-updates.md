# AI refactors that update paths correctly

Date: 2026-09-20

Scope: how to make AI-assisted folder and module restructuring update imports, paths, and dependency boundaries with the same reliability that VS Code gives when a file moves.

## Findings

Status checked on 2026-09-20.

VS Code updates JavaScript and TypeScript imports on file move because the editor asks the language tooling for edits. The JavaScript docs say VS Code can update import paths that reference a moved or renamed file. The `js/ts.updateImportsOnFileMove.enabled` setting can prompt, always update, or never update. Source: [Visual Studio Code JavaScript docs, "Update imports on file move"](https://code.visualstudio.com/Docs/languages/javascript#_update-imports-on-file-move).

The mechanism is a workspace edit, not text guessing. The VS Code API exposes `workspace.onWillRenameFiles`, whose event lets an extension pause the rename and return a `WorkspaceEdit` before the files move. The same API says rename events come from user gestures and `workspace.applyEdit`, but not from arbitrary disk changes. Source: [VS Code API, `onWillRenameFiles` and `FileWillRenameEvent`](https://code.visualstudio.com/api/references/vscode-api#workspace).

The TypeScript server has a first-class file-rename command. A language service is a long-running process that answers editor questions about code. The TypeScript server protocol includes `GetEditsForFileRename`, with arguments `oldFilePath` and `newFilePath`, and notes that paths can also be directories. Source: [TypeScript `protocol.ts`, `GetEditsForFileRenameRequestArgs`](https://github.com/microsoft/TypeScript/blob/main/src/server/protocol.ts).

The TypeScript language service also exposes `getEditsForFileRename(oldFilePath, newFilePath, formatOptions, preferences)`, which returns file text changes. Source: [TypeScript `types.ts`, language service interface](https://github.com/microsoft/TypeScript/blob/main/src/services/types.ts).

VS Code's TypeScript extension calls the TypeScript server through typed requests such as `getEditsForFileRename`, then applies returned file edits during a path rename. Source: [VS Code TypeScript service request map](https://github.com/microsoft/vscode/blob/main/extensions/typescript-language-features/src/typescriptService.ts) and [VS Code path-rename update](https://github.com/microsoft/vscode/blob/main/extensions/typescript-language-features/src/languageFeatures/updatePathsOnRename.ts).

Language servers are the portable layer for many editor operations. The Language Server Protocol, or LSP, lets tools reuse one language-aware process for features such as definition, references, completion, and rename. Source: [Language Server Protocol overview](https://microsoft.github.io/language-server-protocol/). VS Code maps programmatic language features such as rename, references, code actions, and refactoring to language servers or extension APIs. Source: [VS Code Programmatic Language Features](https://code.visualstudio.com/api/language-extensions/programmatic-language-features).

Module boundaries need compiler support, not only import rewrites. TypeScript project references split a program into smaller projects, enforce logical separation, and make build mode build referenced projects in order. Source: [TypeScript Project References](https://www.typescriptlang.org/docs/handbook/project-references). TypeScript module resolution defines how import strings map to files and is controlled by options such as `moduleResolution`, `paths`, `baseUrl`, `rootDirs`, package `exports`, and package `imports`. Source: [TypeScript Modules Reference](https://www.typescriptlang.org/docs/handbook/modules/reference.html) and [TypeScript Modules Introduction](https://www.typescriptlang.org/docs/handbook/modules/introduction.html).

Codex can connect to third-party MCP servers. OpenAI documents local STDIO and HTTP MCP servers for the ChatGPT desktop app, Codex CLI, and the Codex IDE extension. Source: [OpenAI MCP documentation](https://learn.chatgpt.com/docs/extend/mcp).

This research did not establish a native Codex TypeScript server or LSP integration. The public protocol document describes user input, model requests, commands, and patches. It does not document an LSP channel. Source: [OpenAI Codex protocol v1](https://github.com/openai/codex/blob/main/codex-rs/docs/protocol_v1.md).

Community MCP servers can give Codex TypeScript refactor tools. For example, `ts-mcp-server` documents `renameFileOrDirectory`, which forwards to TypeScript's `getEditsForFileRename-full`. This is a third-party project, not a server maintained by OpenAI or TypeScript. Source: [ts-mcp-server](https://github.com/AndyLiner13/ts-mcp-server).

Claude Code has first-party LSP plugin support for TypeScript. The official `claude-plugins-official` repository contains `typescript-lsp`, and its README says that it is a TypeScript/JavaScript language server for Claude Code. It lists `.ts`, `.tsx`, `.js`, `.jsx`, `.mts`, `.cts`, `.mjs`, and `.cjs`, and tells users to install `typescript-language-server` and `typescript`. Source: [Anthropic `typescript-lsp` README](https://github.com/anthropics/claude-plugins-official/blob/main/plugins/typescript-lsp/README.md).

The official plugin marketplace configuration wires `typescript-lsp` to `typescript-language-server --stdio`. It maps TypeScript and JavaScript extensions to LSP language IDs. Source: [Anthropic marketplace `typescript-lsp` entry](https://github.com/anthropics/claude-plugins-official/blob/main/.claude-plugin/marketplace.json).

The TypeScript language server that Claude Code uses is an LSP wrapper around TypeScript's `tsserver` API. Its README says the TypeScript package includes `tsserver`, and that this project provides a thin LSP interface on top of the TypeScript language features code base. It also documents workspace commands for source definition, refactoring, organize imports, file rename, and raw `typescript.tsserverRequest`. Source: [typescript-language-server README](https://github.com/typescript-language-server/typescript-language-server).

Claude Code's documented TypeScript LSP plugin support does not by itself prove that the agent can call every `typescript-language-server` workspace command. I found no first-party Claude Code document that says the exposed Claude tool can call `_typescript.applyRenameFile`, `typescript.tsserverRequest`, or TypeScript's `GetEditsForFileRename`. Treat direct semantic file move support in Claude Code as not established until the available tool schema confirms those operations.

The precise support matrix is:

| Target | Native TypeScript server or LSP support | Direct semantic file-move refactor support |
| --- | --- | --- |
| TypeScript | Yes. `tsserver` and the language service expose file rename edits. | Yes, through `GetEditsForFileRename` and `getEditsForFileRename`. |
| VS Code | Yes. Its built-in JavaScript and TypeScript feature stack uses TypeScript tooling. | Yes, for imports seen by the JavaScript or TypeScript project. |
| Claude Code | Yes, through the official `typescript-lsp` plugin and `typescript-language-server --stdio`. | Not established from first-party docs or plugin metadata. |
| Codex | No native integration is established. Codex can connect to external MCP servers. | Available from third-party MCP servers, but not established as a native Codex capability. |

## Practical model

An AI refactor must treat the language service as the source of truth for mechanical path updates.

The AI must do this job:

1. Build the desired destination map: `old path -> new path`.
2. Ask the language service or compiler-backed tool for edits for each move.
3. Apply the file moves and the returned workspace edits as one planned change.
4. Run organize imports, format, typecheck, lint, and the narrow test suite.
5. Inspect the remaining failures and only then make judgment edits.

The AI must not start by scanning strings and replacing paths. Text replacement is a fallback for files outside the language service, such as shell scripts, build configuration, JSON manifests, markdown links, asset references, and runtime string paths.

## What Argo can build

Argo can expose a `semantic move` operation to agents. It accepts a list of old and new paths, then delegates to per-language backends.

For TypeScript and JavaScript, the backend calls the TypeScript server command `GetEditsForFileRename`, the language service method `getEditsForFileRename`, or the LSP wrapper command `_typescript.applyRenameFile` when the client exposes it. The operation also runs organize imports after the move.

The operation returns a structured report:

- Files moved.
- Imports updated by language tooling.
- Non-code path strings that were changed by explicit rules.
- Non-code path strings that remain candidates.
- Diagnostics before and after.
- Tests or gates that passed or failed.

This gives the agent a closed loop. The model decides the architecture, but the compiler and language server own the mechanical rewrite.

## Workflow prompt for agents

Use this shape when asking an AI agent to restructure folders:

```text
Plan the folder move first. Produce old path -> new path pairs.
For TypeScript/JavaScript files, use the language service file-rename edits instead of manual import rewriting.
Apply the move in one workspace edit when possible.
Then run organize imports, typecheck, lint, and focused tests.
Report every remaining non-code path string and every dependency-boundary change.
Do not finish until the compiler and focused tests are green, or until you list the exact blockers.
```

## Limitations

VS Code's automatic import update covers imports that the TypeScript project can see. It does not prove that runtime string paths, generated files, asset URLs, package manifests, custom module resolvers, or documentation links are correct.

Claude Code's TypeScript LSP plugin is code-intelligence support. It is not enough evidence for automatic folder restructuring until the available Claude Code LSP tool schema exposes the file-rename command or a custom tool wraps it.

Codex can use TypeScript refactor tools through an external MCP server or a repository command. Neither path is native Codex support. Review a third-party server's code, maintenance, permissions, and output before you enable it for a Workspace.

Project references and package boundaries can prove more than import updates alone. If a folder is a real dependency boundary, represent it in `tsconfig` references, package exports, or the build graph. Then the compiler can reject illegal imports after the AI moves files.

The best AI workflow is therefore not "let the model rewrite imports." It is "let the model choose the restructuring, then force every mechanical edit through semantic tools and gates."
