# What can be derived from any repo with no prior setup

**Date:** 2026-08-11 · **For:** wayfinder [#644](https://github.com/milad-alizadeh/argo/issues/644), blocking the node question on the [#643 Project Atlas map](https://github.com/milad-alizadeh/argo/issues/643) · **Status:** primary-source survey, several claims measured on real repos

## The question

The atlas must teach a person how **any** registered Project works, with no `CONTEXT.md`, no ADRs,
possibly no README. So: what raw signal is actually extractable from an arbitrary git repo, what
does each source cost, which ecosystems does it cover, and — the part the node question hangs on —
**what can a node honestly claim from derived signal alone, and what always needs an LLM's
inference?**

## Method

Five strands, each investigated against primary sources only — official docs, the tool's own repo
and source, specs, and `--help` output actually run. Swift and TypeScript were also **verified by
execution** against real repos: `apps/macOS` (Swift 6.3.3 / Xcode 26.6, 454 first-party sources),
this monorepo, and `~/Developer/changeplan` (9,833 commits) for the git-history timings. Claims
that could not be reached from a primary source are marked **[unverified]** in place rather than
dropped.

---

## The organising fact: three tiers of evidence

Every extraction tool in this survey sits in exactly one of three tiers, and the tier — not the
language — predicts cost, coverage, and failure mode.

| Tier | Cost | What it yields | Survives broken/unbuildable code? |
|---|---|---|---|
| **Read** — manifests, configs, filesystem, git | milliseconds–seconds | declared structure, entry points, history | **Yes** |
| **Parse** — tree-sitter, swift-syntax, `ts.preProcessFile`, ctags | ~1s for a whole repo | names, imports, nesting, attributes — all unresolved | **Yes** |
| **Resolve** — LSP, index stores, symbol graphs, type checkers | 15s–hours, often a full build | references, conformances, call/type hierarchy, types | **No** |

Two measurements make the gap concrete. Parsing all 454 Swift files in `apps/macOS`: **1.0s wall**.
`swift package dump-symbol-graph` on the same package: **34.5s** — and it emits **nothing at all**
for a module containing one unresolved type, not even for the well-formed declarations beside it.
The `.build` directory it needs is **847MB**.

**Everything above the Read tier degrades to silence, not to an error.** SourceKit-LSP answers
`textDocument/references` with `[]` on an unindexed file. tsserver's `workspaceSymbol` returns `[]`
for a module nothing imports. Both look identical to "there are genuinely no references." This is
the single most important operational fact in the survey and it maps directly onto Argo's
[degrade-down rule](../domain/honesty-tier.md): an atlas must distinguish *no answer* from *the
answer is none*, or it will render a false DIRECT.

---

## 1. Read tier — the cheapest signal, and the best

### Package manifests

The highest signal-to-cost ratio anywhere in this survey. All of these are machine-readable, need
no build, and complete in under a second on a resolved package.

| Ecosystem | Command | Gives you |
|---|---|---|
| Swift | `swift package describe --type json` | targets with **type** (`regular`/`executable`/`test`), module name, path, **the complete source-file list**, resources, product memberships, and target→target **and** target→product edges separately |
| Swift | `swift package dump-package` · `show-dependencies --format json` | raw manifest AST; resolved transitive tree with concrete versions |
| Go | `go list -json ./...` ([cmd/go](https://pkg.go.dev/cmd/go)) | `ImportPath, Name, GoFiles, CgoFiles, Imports, Deps, TestGoFiles, TestImports, XTestImports, Module, Standard`. `-deps` walks transitively in post-order; **`-e` keeps going on broken packages** |
| Rust | `cargo metadata --format-version=1` ([docs](https://doc.rust-lang.org/cargo/commands/cargo-metadata.html)) | `packages`, per-package `targets` with `kind` (`lib`/`bin`/`test`/`bench`/`example`/`custom-build`), `resolve` graph, `workspace_members`. **Does not compile.** `--no-deps` stays inside the workspace |
| JS/TS | `package.json` `exports`/`bin`/`main`/`files`/`scripts` | see below |
| Java | `mvn dependency:tree`, `gradle projects` | module graph (needs the build tool, and Gradle configuration is code) |
| C/C++ | **CMake File API** ([docs](https://cmake.org/cmake/help/latest/manual/cmake-file-api.7.html)) | `codemodel` v2: targets, sources, per-target compile groups, inter-target build **and** link dependencies, directory hierarchy, install rules — as JSON. Requires a `cmake` **configure** (not a build) |

**Swift's manifest executes arbitrary code** — `Package.swift` is Swift that is compiled and run.
SwiftPM sandboxes it; the only primary evidence found is the `--disable-sandbox` flag in
`swift package --help`, since SwiftPM's prose docs migrated to DocC and the `PackageSecurity` page
covers signing, not sandboxing. **[unverified as prose policy]**

**Cannot tell you:** anything inside the sources. And a manifest with conditional logic
(`#if os()`, computed target lists, a Gradle `subprojects {}` loop) dumps only for the *current*
host and configuration.

### `package.json` and the Node resolution spec

[nodejs.org/api/packages.html](https://nodejs.org/api/packages.html) is authoritative and carries a
fact the atlas should lean on: **`exports` encapsulates.** When present, any subpath not listed
throws `ERR_PACKAGE_PATH_NOT_EXPORTED` — including `require('pkg/package.json')`. So `exports` is a
machine-readable statement of the package's public surface, and **its absence means the whole file
tree is public.** Conditions resolve in documented order: `node-addons`, `node`, `import`,
`require`, `module-sync`, `default` (last). `types`, `browser`, `development`, `production` are
community conditions Node ignores without `--conditions`. **`"module"` does not appear in the Node
spec at all** — it is a bundler convention and should not be read as authoritative.

TypeScript's reading ([modules reference](https://www.typescriptlang.org/docs/handbook/modules/reference.html))
adds one assumption worth flagging: when `exports` doesn't apply it falls back `types` → `typings` →
`main`, and *"the declaration file found at `types` is assumed to be an accurate representation of
the implementation file found at `main`"* — an assumption nothing verifies.

Other fields as signal: `bin` + a `#!/usr/bin/env node` shebang ⇒ CLI. `files` ⇒ the author's own
statement of published surface. `private: true` ⇒ never published. **`scripts` is often the
highest-value region in a doc-less repo** — it names the build tool, test runner and lint gate in
the team's own words.

### Monorepo topology — verified against real trees

| Command | Needs `node_modules`? | Behaviour on a bare tree |
|---|---|---|
| `yarn workspaces list --json -v` ([docs](https://yarnpkg.com/cli/workspaces/list)) | **no** | works instantly; NDJSON, one object per line. The only tool giving internal workspace edges with **zero install and zero lockfile** — but `workspaceDependencies` are *locations*, not names, and there is no version or private flag |
| `pnpm list -r --json` ([docs](https://pnpm.io/cli/list)) | **no** | **degrades silently** to projects-only, exit 0. Post-install, workspace-local deps are identifiable three ways: `version: "link:../b"`, an in-workspace `path`, and **`resolved` absent** |
| `turbo query '{packages{items{name path directDependencies{...}}}}'` | no | a real GraphQL package graph; `turbo ls --output=json`; `turbo run build --dry=json` adds the **task** graph with per-task content hashes, inputs, cache state, resolved task definition |
| `nx graph --file=out.json` ([docs](https://nx.dev/docs/features/explore-graph)) | — | `{nodes, dependencies}` with node `type` ∈ `app｜e2e｜lib` and **`DependencyType` ∈ `static｜implicit｜dynamic`** — the only tool here that labels *how* an edge was established |
| `npm query` ([selectors](https://docs.npmjs.com/cli/using-npm/dependency-selectors)) | yes, or lock + `--package-lock-only` | **silently returns `[]`** for `.workspace` on a bare tree. `from`/`to` are edge lists — that's your graph. **There is no "is a workspace" field** |
| `npm ls --json --all` | yes | hard-fails `ELSPROBLEMS` on this repo's bun tree (`extraneous`/`missing`) — but **still writes a usable partial tree on exit 1**, gaining `problems[]` |
| `bun pm ls` | yes | shows `@argo/macos@workspace:apps/macOS`; **bun 1.3.14 documents no `--json` flag** |

**Cannot tell you:** why a package exists, layering intent, which internal edges are load-bearing
versus incidental, or any dependency expressed through runtime wiring rather than a manifest.

### Xcode projects, and the thing that changed

`xcodebuild` has query commands that the man page explicitly states **do not initiate a build**:
`-list`, `-showBuildSettings`, `-showdestinations`, `-showsdks`, `-showTestPlans`. Measured on
`apps/macOS`: `-list -json` **3.7s**, `-showBuildSettings -json` **2.0s** for **562 keys** including
`PRODUCT_BUNDLE_IDENTIFIER`, `SWIFT_VERSION`, `MACOSX_DEPLOYMENT_TARGET`, `PRODUCT_TYPE`,
`CODE_SIGN_ENTITLEMENTS`. Note `-showdestinations` prints `Resolve Package Graph` — **it needs
network on a cold checkout**, unlike `-list`. Also: `-list` showed **6 schemes but only 2 targets**,
because four schemes are auto-generated from package references.

**The structural finding: `PBXFileSystemSynchronizedRootGroup`.** This project is
`objectVersion = 77`, and its 424-line `pbxproj` contains **only 3 `PBXFileReference` entries** —
two build products and the entitlements file. Source files are **not in the pbxproj at all**;
targets carry `fileSystemSynchronizedGroups` and membership is a filesystem walk. **Any tool that
reads build phases sees an Xcode 16+ target as having zero sources.** Both maintained parsers —
[tuist/XcodeProj](https://github.com/tuist/XcodeProj) (Swift, library only, no Xcode or macOS
needed) and [CocoaPods/Xcodeproj](https://github.com/CocoaPods/Xcodeproj) (Ruby, ships a CLI:
`xcodeproj show`) — model the *declaration* of a synchronized group but do not enumerate the
directory for you.

Shared schemes (`xcshareddata/xcschemes/*.xcscheme`) are plain XML giving the full action model:
`BuildAction` with per-action flags, `TestAction` → `Testables` → `BuildableReference`,
`LaunchAction`, per-action `buildConfiguration`. **Only shared schemes are in git** —
`xcuserdata/` is per-user and typically gitignored, so scheme-derived signal is partial by
construction.

### Build-system graphs — the gold standard, where it exists

**Bazel** ([query guide](https://bazel.build/query/guide),
[language](https://bazel.build/query/language)) is the only build system that answers the atlas's
question natively and without building. `bazel query --output=proto｜streamed_proto｜textproto｜streamed_jsonproto`
emits `QueryResult` protos carrying rule attributes, `srcs`, `deps`, `data`, and `rule-input`/
`rule-output` edges. `deps()`, `rdeps(universe, x)`, `somepath()` answer forward, reverse and
path-between queries. Also `label_kind`, `location`, `package`, `graph`, `minrank`/`maxrank`.
`cquery` adds resolved toolchains. When a repo uses Bazel or Buck2, **the atlas's dependency graph
is a solved problem** — the repo already declares it.

Everything else is degrees worse: CMake needs a configure, Gradle configuration is code, and
**`make` is not reliably introspectable**. Nx and Turbo give a *task* graph, which is a different
(and also useful) thing from an import graph.

### CI, containers and deployment — the cheapest high-signal artifact

`.github/workflows/*.yml` ([workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax))
is **pure YAML: statically parseable, zero install, zero execution**. It gives what nothing else
gives — the *authoritative* statement of what the team considers green: the exact `run:` commands
that gate a merge, the job DAG via `needs:`, the support matrix via `strategy.matrix`, path filters,
and toolchain implications (`actions/setup-node` with `cache: pnpm` ⇒ pnpm).

**Cannot tell you:** anything behind composite or reusable actions, `${{ }}` expressions resolved
from secrets or contexts, or `if:` conditions on runtime state.

`Dockerfile` ([reference](https://docs.docker.com/reference/dockerfile/)) is likewise fully static:
`ENTRYPOINT`, `CMD`, `EXPOSE`, `WORKDIR`, `USER`, and multi-stage `FROM … AS` tell you how the thing
actually runs and what it listens on. The one parsing hazard is exec-form (JSON array) vs shell-form
(bare string), which change signal handling and variable substitution.

`AndroidManifest.xml` ([intro](https://developer.android.com/guide/topics/manifest/manifest-intro))
is the strongest declarative case in mobile: components (activity/service/receiver/provider),
intent filters — including the `MAIN`/`LAUNCHER` entry point — permissions, and SDK levels, all
statically readable. Caveat: the **manifest merger** folds in library manifests at build time, and
`build.gradle` overrides `uses-sdk`.

### Schema files that *are* the API

The strongest category the survey turned up, and easy to under-weight.

- **OpenAPI** ([spec](https://spec.openapis.org/oas/latest.html)) — a static JSON/YAML document
  containing paths, operations, parameters, request bodies, responses, `components/schemas`, and
  security. It describes the complete HTTP surface **without running the server**.
- **Protobuf / [buf](https://buf.build/docs/reference/cli/buf/build/)** — `buf build` compiles
  `.proto` into a Buf image (or `--as-file-descriptor-set` for a plain
  `google.protobuf.FileDescriptorSet`), containing services, methods, messages, fields, enums,
  extensions. No target-language codegen involved.
- **GraphQL SDL** — a committed `.graphql` schema is statically readable; introspection is a
  runtime query against a live server. **[unverified — spec.graphql.org and graphql.org both
  returned 403 to fetch; this is asserted, not cited]**

Where a repo commits one of these, the atlas gets an API node at Read-tier cost with no inference
at all.

### Lint and format configs as architectural signal — underrated

`apps/macOS/.swiftlint.yml` turned out to be the single most **reliable** source-root map found
anywhere in the Swift investigation:

```yaml
included: [Argo, Packages/ArgoUI/Sources, Packages/ArgoEngine/Sources, ...]
excluded: [build, .build, Argo.xcodeproj, .../Fixtures]
analyzer_rules: [unused_import]
```

`included:` enumerates first-party roots **exactly** — better than any heuristic, and precisely the
scoping that would have prevented a naive `grep -rn "@main"` from returning 25 hits of which **24
were in `build/SourcePackages/checkouts/`**. Vendored checkouts inside the tree dominate any
unscoped scan.

On the JS side, ESLint's `--print-config <file>`
([CLI docs](https://eslint.org/docs/latest/use/command-line-interface)) — *"no linting is
performed"* — is the only reliable read of effective rules for a path, because flat config is an
executed module. `no-restricted-imports` and `import/no-restricted-paths` zones frequently encode
**the only machine-readable statement of layering in a doc-less repo**. Argo's own
`scripts/swift-boundaries.sh` is the same idea as a shell gate.

**Cannot tell you:** whether the rules are obeyed, or whether boundaries are enforced by something
outside the linter.

---

## 2. Parse tier — names without meaning

### Tree-sitter, ctags, ast-grep

**[This strand is the thinnest in the survey.](#what-could-not-be-verified)** The cross-language
agent did not return, and the claims below are from my own knowledge, marked accordingly.

- **[Universal Ctags](https://github.com/universal-ctags/ctags)** — very broad language coverage,
  single-pass, effectively free. `--output-format=json` with `--fields=*` yields per-tag `name`,
  `kind`, `scope`, `signature`, `access`, `line`. **[unverified: exact field list and language
  count not confirmed against ctags' own docs this session.]** Cannot resolve anything across
  files; a tag is a name and a location.
- **[Tree-sitter](https://tree-sitter.github.io/tree-sitter/)** — incremental parsers for a very
  large set of grammars, plus `.scm` query files. The `tags.scm` convention (captures like
  `@definition.function`, `@reference.call`, `@name`, `@doc`) is what powers GitHub's code
  navigation. **[unverified: the code-navigation docs URL 404'd this session; treat the capture
  names as recalled, not cited.]** Gives definitions and call *sites* per file with zero toolchain;
  cannot resolve which definition a call refers to, and knows no types.
- **[ast-grep](https://ast-grep.github.io)** and **[Semgrep](https://semgrep.dev/docs/)** — pattern
  matching over tree-sitter/proprietary ASTs across many languages. Good for "find every
  `@RestController`" or "find every `app.get(`" style entry-point sweeps at parse cost.
  **[unverified this session.]**
- **[GitHub Linguist](https://github.com/github-linguist/linguist)** — language detection plus, more
  usefully, the **vendored/generated exclusion lists**. Its `.gitattributes` overrides
  (`linguist-vendored`, `linguist-generated`, `linguist-documentation`, `linguist-detectable`,
  `linguist-language=`) are the best available *declared* list of what is not first-party. **No git
  command honours them** — only GitHub and Linguist do — but reusing them as exclusion pathspecs is
  the highest-value five lines of code in this whole survey.

### Parsing per ecosystem, where it was verified

**Swift — [swift-syntax](https://github.com/swiftlang/swift-syntax)** (603.0.2). Measured at
**~750k lines/s single-threaded**; the whole 454-file tree lints in **1.0s wall**. It survives
broken code: `swiftc -frontend -dump-parse` on a file importing a nonexistent module and inheriting
a nonexistent type completed in **0.18s, exit 0** with a full tree — where the symbol graph emitted
nothing.

Gives: imports, declaration nesting, attributes (`@main`, `@Observable`, property wrappers),
access modifiers including `private(set)`, function signatures with labels, generic and `where`
clauses, inheritance-clause *spellings*, doc comments as trivia.

**The load-bearing limitation, and it is sharp:** in `class Box: NSObject, Codable, Fooable`, all
three are identical `IdentifierTypeSyntax` nodes. **Which is the superclass, which are protocols,
and whether any of them exist is not recoverable syntactically.** "Superclass first" is convention,
not grammar. Also invisible: the defining module of any name, typealias dereferencing, conformances
added by an extension elsewhere, implicit conformances (`Copyable`, `Sendable`, synthesized
`Equatable`/`Codable`), macro expansions, and `#if` branch selection — all branches are in the tree.

**TypeScript — `ts.preProcessFile`** is the cheapest thing in the JS toolchain: a pure lexical scan
of one file, no program, no config, no `node_modules`, returning
`{importedFiles: [{fileName, pos, end}], referencedFiles, typeReferenceDirectives}`. It is a
complete import-graph skeleton at parse cost, and it makes both `madge` and `dependency-cruiser`
optional for a first pass.

---

## 3. Resolve tier — types, references, and what they cost

### The LSP generalisation question

LSP defines the structure-relevant requests — `textDocument/documentSymbol`, `workspace/symbol`,
`callHierarchy/*`, `typeHierarchy/*`, `references`, `definition`, `typeDefinition`,
`implementation`, `semanticTokens`, `foldingRange`
([LSP 3.17](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/))
— but **every one of them is optional**, advertised per-server in the `initialize` response's
capabilities. There is no floor. The honest generalisation is: **`documentSymbol` is near-universal;
`callHierarchy` is common but not guaranteed; `typeHierarchy` is rare.**

Two servers were checked directly, and they disagree:

- **SourceKit-LSP** ([repo](https://github.com/swiftlang/sourcekit-lsp)) implements the full set,
  read from `Sources/SourceKitLSP/SourceKitLSPServer.swift` on `main`: `DocumentSymbol`,
  `WorkspaceSymbols`, `CallHierarchyPrepare`+incoming+outgoing, **`TypeHierarchyPrepare`+supertypes+
  subtypes**, `References`, `Definition`, `Declaration`, `Implementation`, `TypeDefinition`,
  semantic tokens, rename, inlay hints. Plus non-standard extensions worth knowing:
  `WorkspaceTestsRequest`/`DocumentTestsRequest` (syntactic test discovery over LSP),
  `DoccDocumentationRequest`, `IsIndexingRequest`, `TriggerReindexRequest`.
- **[typescript-language-server](https://github.com/typescript-language-server/typescript-language-server)**
  supports `documentSymbol`, `workspaceSymbol`, `references`, `definition`, `typeDefinition`,
  `implementation`, semantic tokens, inlay hints, rename. `callHierarchy` is **conditional** on the
  TS version (`gte(API.v380)`). **`typeHierarchy` is not supported — zero occurrences in the
  source.** Class hierarchy in TS must come from the AST or `implementationProvider`.

**The index divide, verified by driving SourceKit-LSP over stdio** against a loose `.swift` file
with no package, no build, no index:

```
documentSymbol   →  full nested result in 0.13s
workspace/symbol →  []
references       →  []
```

That is the whole story. **Syntactic requests need nothing; anything cross-file is index-backed and
silently returns empty without one.** Background indexing is on by default in Swift 6.1+ and
sourcekit-lsp maintains its own `.build/index-build/` — measured at **279MB** beside SwiftPM's own
34MB store.

The same trap appears in tsserver, in two forms verified by execution:

1. **The inferred project spans only the import graph reachable from files you have opened.** An
   orphan module nothing imports returned `[]` from `navto`. Adding a two-line `jsconfig.json` with
   a wide `include` made it appear immediately. **Synthesise a config before indexing** — this is
   the single most actionable finding on the JS side.
2. **Size limits fail quiet.** From the shipped `typescript.js`:
   `maxProgramSizeForNonTsFiles = 20MB` (aggregate, non-`.ts` only) and `maxFileSize = 4MB`, shared
   across projects. When tripped the language service is **disabled** —
   `languageServiceDisabled: true` and every semantic request returns empty. **Check that flag
   before trusting any empty result.**

And one ecosystem-shaped surprise: **CommonJS breaks call hierarchy and definition-side references;
ESM does not.** Same JS, same JSDoc:

| Repo style | incoming calls | `references` from the definition |
|---|---|---|
| TS + ESM | 1 caller | 3 refs / 2 files |
| **JS + CommonJS** | **`[]`** | **2 refs, same file only** |
| JS + ESM + JSDoc | 1 caller | 3 refs / 2 files |

Querying from the *call site* in the CJS case did return all four. **In CJS repos, never read an
empty call-hierarchy result as evidence of dead code.**

### SCIP and LSIF — the portable index formats

[SCIP](https://github.com/sourcegraph/scip) is a language-agnostic protobuf indexing protocol
powering go-to-definition, find-references and find-implementations. Its own repo lists **10
indexers**: Java/Scala/Kotlin (`scip-java`), TypeScript/JavaScript (`scip-typescript`), Rust
(rust-analyzer), C/C++ (`scip-clang`), Ruby, Python, C#/VB, Dart, PHP, and Debian packaging.
**There is no Swift indexer**, and the repo publishes no maturity ratings. [LSIF
0.6](https://microsoft.github.io/language-server-protocol/specifications/lsif/0.6.0/specification/)
is the older Microsoft format SCIP was designed to replace.

The honest read: **SCIP does not generalise for free.** It is one indexer per language, each with
its own build requirements, its own maturity, and — for the languages Argo cares most about — a hole
where Swift should be. Swift's equivalent is the native index store (below), which is not SCIP.
**[unverified: per-indexer maturity, build requirements, and the exact `scip` CLI surface
(`snapshot`/`stats`/`convert`) were not confirmed against primary sources this session.]**

### Swift's resolve tier, in detail

**Index store / [IndexStoreDB](https://github.com/swiftlang/indexstore-db)** — produced by
`-index-store-path` during compilation; SwiftPM emits it by default at `.build/debug/index/store`,
Xcode at `Index.noindex/DataStore`. Verified on real DerivedData: **927 unit files, 3,541 record
files, 38–50MB per build**, with ten stale DerivedData copies on this machine holding ~390MB of
index alone. It answers symbol occurrences by USR with roles, canonical definitions, and relations
(`childOf`, `baseOf`, `overrideOf`, `calledBy`). There *is* a CLI — `Package.swift` declares an
`index-dump` executable, contrary to common assumption. **[unverified: the `SymbolRole` case list
was not read from source.]**

**Cannot tell you:** anything about code not compiled in that build. A target excluded from the
scheme is invisible — which is the #1 false-positive source for
[Periphery](https://github.com/peripheryapp/periphery), whose README is refreshingly explicit that
*"the index store only contains information about source files in the build targets compiled during
the build phase."* `#if`-inactive branches are absent too.

**Symbol graphs** ([SymbolKit](https://github.com/swiftlang/swift-docc-symbolkit)) — four routes in,
with wildly different costs: `swift symbolgraph-extract` on a prebuilt module **0.15s**;
`swift package dump-symbol-graph` **34.5s**; `swift build -Xswiftc -emit-symbol-graph-dir` 15.7s
cold. The 0.15s-vs-34.5s gap is the useful discovery — **extraction is nearly free; the SwiftPM
subcommand's cost is entirely frontend re-invocation.**

Format `0.6.0`, `{metadata, module, symbols, relationships}`. ArgoEngine at `internal`: **1,456
symbols, 1,862 relationships**. Per symbol: `identifier.precise` (a USR — **the same identifier the
index store uses**, which is how you fuse a cheap symbol graph with an expensive index),
`accessLevel`, `pathComponents`, `declarationFragments`, `functionSignature`, `docComment` with
ranges, `location`, `swiftGenerics`, `swiftExtension`.

SymbolKit defines 11 relationship kinds; **the Swift compiler emits only 8** (`memberOf`,
`conformsTo`, `inheritsFrom`, `defaultImplementationOf`, `overrides`, `requirementOf`,
`optionalRequirementOf`, `extensionTo`). **`references` and `overloadOf` are never emitted — so
there is no call graph here**, despite the format having a slot for one.

What it gives that parsing cannot, verified on a toy module: for
`struct Widget: Identifiable, Codable` with `extension Widget: Renderer`, the graph emitted
`conformsTo` edges to `Identifiable`, `Codable`, the extension-declared `Renderer`, **and** implicit
`Copyable`/`Escapable`, plus the synthesized `init(from:)` as a member. None of that is in the
source text.

Access filtering: default is **public only** (1,028 symbols), internal 1,456, private 1,885. Flag
spellings differ per tool — `swiftc` uses `-symbol-graph-minimum-access-level`,
`symbolgraph-extract` uses `-minimum-access-level`, SwiftPM uses `--minimum-access-level`.

**`swift-api-digester`** (via `xcrun`, not on `PATH`) `-dump-sdk` produced **1.6MB in 0.3s** on a
prebuilt module: a nested `ABIRoot` tree with fully-materialised `conformances` per type (USR +
mangled name, including implicit and synthesized ones), resolved parameter/return types as
`TypeNominal` children, `declAttributes`, per-accessor nodes. **No doc comments, no source
locations for Swift decls, no relationships array.** Two traps: `-diagnose-sdk` **exits 0 even when
it reports breakages** (needs `-error-on-abi-breakage`), and the `ModuleName.abi.json` SwiftPM drops
beside a debug build is **empty** (`"name": "NO_MODULE"`).

### TypeScript's resolve tier — the cost-effective rungs

Measured on TypeScript 5.9.3:

| Flag | Observed |
|---|---|
| `--listFilesOnly` | same file list as `--listFiles` but **stops before checking** — printed no diagnostic and **exited 0** with a deliberate `TS2322` in the tree. **0.27s vs 0.63s** for `--noEmit`. **The flag to reach for on an arbitrary repo**: error-tolerant and ~2.3× cheaper |
| `--explainFiles` | the only flag answering *why* a file is present, and it carries `packageId` with the resolved version — how you separate first-party from type-dependency files without path heuristics |
| `--showConfig` | expands `extends` chains and implied defaults, **and resolves `include` globs into a literal `files` array**. Near-instant |
| `--emitDeclarationOnly --declaration --allowJs` | synthesises a typed public API **from a plain-JS module's JSDoc**, comments carried through — a generated API document for an undocumented repo |
| `tsc -b --dry --verbose` | enumerates the **project-reference graph in topological order** without compiling. Sub-second, needs only `typescript` |
| `--extendedDiagnostics` | `Lines of Library / Lines of Definitions / Lines of TypeScript` — a real "how much of this program is the repo" ratio |

**Cost scales with type complexity, not file count** — a 194-file project spent **0.72s** checking,
*longer* than a 2,000-file synthetic one at 0.27s. Budget by `Instantiations`, not files.

**Zero-install coverage, verified:** on two CommonJS files with no tsconfig and no `node_modules`,
`tsc --allowJs --checkJs --noEmit --listFiles index.js` followed `require("./lib/h")`. **Relative
first-party edges resolve with zero install; bare specifiers silently do not appear.**

Stability caveat: the compiler API wiki still says verbatim *"this is not yet a stable API."* And
`npx -p typescript tsc` now installs **7.0.2** (the native port), which in the same directory listed
66 files where 5.9 listed 194 — **pin your TypeScript version.**

### The rest of the resolve tier, by ecosystem

- **Java** — [`jdeps`](https://docs.oracle.com/en/java/javase/21/docs/specs/man/jdeps.html) analyses
  **`.class` files, not source**: package- or class-level dependencies (`-verbose:class`), DOT output
  (`-dotoutput`), `--print-module-deps`. Requires compiled bytecode.
- **C/C++** — [`compile_commands.json`](https://clang.llvm.org/docs/JSONCompilationDatabase.html)
  (`directory`, `file`, `arguments`/`command`, optional `output`) is the universal handoff. Produced
  by CMake's `CMAKE_EXPORT_COMPILE_COMMANDS`, by Bear, by `clang -MJ`, or by a Bazel extractor.
  Everything semantic in C/C++ (clangd, clang-tidy) needs it.
- **Python** — [`griffe`](https://mkdocstrings.github.io/griffe/) extracts API surface **statically
  via AST or dynamically by importing**, serialises to JSON (`griffe dump`), and diffs for breaking
  changes (`griffe check`). Entry points are declared per the
  [entry-points spec](https://packaging.python.org/en/latest/specifications/entry-points/)
  (`console_scripts`, recorded as `entry_points.txt` in `*.dist-info`). Python's dynamism is the
  hard ceiling — anything built by `getattr`, a registry, or an import hook is invisible statically.
- **Rust** — `cargo metadata` at Read tier; rustdoc JSON and rust-analyzer's SCIP output at Resolve
  tier. **[unverified: rustdoc JSON's nightly-only status was not confirmed this session.]**

---

## 4. Git history — cheap, incremental, and systematically biased

The full strand is the most measured part of this survey. Timings on `changeplan` (9,833 commits,
46MB `.git`), git 2.50.1, Apple silicon:

| Command | Wall time |
|---|---:|
| `git log --format='%H %at %aN'` (no diff) | **0.13s** |
| `git log --name-status` | 0.28s |
| `git log --numstat -M` (default rename detect) | 2.26s |
| `git log --numstat -C -C` | **9.79s** |
| `git rev-list --count HEAD` | 0.055s |
| `git blame --line-porcelain` (one 1,400-line file) | 0.33s |
| `git blame --line-porcelain -w -C -C -C` (same file) | **25.96s** — 78× |

**The commit walk is ~5% of the cost; the tree diff is ~95%.** Rename detection is nearly free
(+6%); copy detection is 4.3×. And `-w -C -C -C` blame is **not** something you turn on for a whole
repo without a budget.

### Incrementality is essentially free

`<sha>..HEAD` for the last 200 commits: **0.075s** versus 2.4s for the full walk — **30–240×
cheaper**. Store the last-processed HEAD SHA; detect rewrites with
`git merge-base --is-ancestor <stored> HEAD` and fall back to a full walk when it fails. Prefer the
SHA-range form over `--since`: git's own docs introduce `--since-as-filter` precisely because plain
`--since` *stops* at the first older commit, which rebased history produces routinely.

**A shallow clone destroys every technique here, silently.** `--depth=1` (the CI default) yields one
commit and a repo that looks brand new. Detect with `git rev-parse --is-shallow-repository`
**before running anything**. Partial clones (`--filter=blob:none`) keep the commit graph intact —
fine for cadence and message mining — but `--numstat` becomes catastrophically slow, because the
docs are blunt that *"dynamic object fetching invokes fetch-pack once for each item."*

### What history gives, and what confounds it

**Hot spots** — files by commit count, optionally weighted by recency and joined with LOC or
complexity. [code-maat](https://github.com/adamtornhill/code-maat) is the canonical tool
(maintained but not developed: last release 2023-02, last commit 2025-07 and README-only). Its
analyses: `revisions`, `authors`, `coupling`, `soc`, `age`, `entity-churn`, `entity-ownership`,
`entity-effort`, `main-dev`, `main-dev-by-revs`, `refactoring-main-dev`, `fragmentation`,
`communication`. **The README documents output columns for only a subset** — the rest had to be read
from the Clojure source, meaning the docs and the tool have drifted.

**Hot spots cannot separate "hot because rotten" from "hot because central."** A router table, a
feature-flag registry and a translations file are all permanently hot and all perfectly healthy.

**Temporal coupling** — code-maat's formula, from `logical_coupling.clj`, is
`degree = shared_revs / mean(revs_A, revs_B) × 100`. It is **symmetric** but the README reads it as
a directional conditional probability, which it is not. Confounders, ranked:

1. **Mass reformatting** — one commit touching every file. The only defence is
   `--max-changeset-size` (default 30). Measured on `changeplan`, the largest changesets were 593,
   137, 134, 100, 88 files; the 593-file commit alone would generate **175,528 spurious pairs**.
2. **Merge commits** — 42% of `changeplan`'s history. Every per-file statistic doubles or halves
   depending on `--no-merges`.
3. **Monorepo version bumps** and **lockfiles** — coupled with their manifest by construction.
4. **Squash merges** — and this is the under-discussed one. **In a squash-merge repo, everything in
   a PR is coupled to everything else in it, so coupling measures PR scope, not design coupling.**
   Argo squash-merges. Change the merge policy and every coupling number changes without a line of
   code moving.

**Authorship is worse than it sounds.** On `changeplan`, one human appears as **at least five
identities** across three email addresses (including a GitHub `noreply` with a numeric prefix),
totalling ~4,600 commits — while the naive #1 contributor reads as 1,519. Neither `changeplan` nor
Argo has a `.mailmap`. **Without one, every authorship number is wrong by an unbounded factor, and
the error is directional: it systematically understates long-tenured contributors**, who accumulate
identities. Bots compound it — 9 of Argo's last 10 commits carry a
`Co-authored-by: Claude …` trailer, and there is no git-level marker for "this is a bot."

**History simplification is the biggest silent distortion of all.** The same file in `changeplan`
returns **426 / 449 / 511 / 1,681 commits** depending on whether you pass `--no-merges`,
`--follow`, nothing, or `--full-history` — a factor of 3.9. `--follow` silently **discards merge
commits**, so it can return *fewer* commits than not using it. No surveyed tool states which
simplification mode it uses. **Any hot-spot ranking must state its flags or it is not
reproducible.**

**Commit messages** give ticket↔file association, release scope, and review participation via
[trailers](https://git-scm.com/docs/git-interpret-trailers) — but note the trailer detection rule is
looser than expected (a block *"consists of at least 25% trailers"*), so use
`git interpret-trailers --parse`, never a regex. And in Argo, subject lines look like
`"Degrade honestly … (#546) (#631)"` — **two numbers, one issue and one squash-merge PR, with
nothing in the string distinguishing them.** Any `#\d+` join would conflate them at roughly 1:1.
Disambiguating needs the code host's API, which is not git.

**SZZ** (bug-fix localisation, [Śliwerski–Zimmermann–Zeller, MSR 2005](https://thomas-zimmermann.com/publications/files/sliwerski-msr-2005.pdf))
deserves a mention only to be ruled out: it classified **29–44% of transactions** on Eclipse and
Mozilla, and **it needs an issue tracker**. Without one it degenerates to "commits whose message
says 'fix'" — a keyword search, not a technique.

### Repo-shape metadata, all cheap and all honest

First-commit date (a fact about the *repo*, not the project — imports and rewrites reset it),
commit cadence by month, `git tag` release history (**Argo has zero tags** — a reminder that release
history frequently lives outside git entirely), and the **merge ratio** (`%P` with more than one
parent): Argo 30/386 = 8%, `changeplan` 4,095/9,833 = 42%. That one number is a good classifier for
*which workflow a repo uses*, and therefore **which of the analyses above are even valid**.

`CODEOWNERS` is worth calling out as a category error waiting to happen: GitHub's docs never claim
it reflects who wrote the code — it is a review-routing *policy*, an assertion of intended
ownership. Comparing it against blame-derived ownership is a genuinely useful divergence signal, but
only one of the two is evidence.

---

## 5. Entry points, routes, and framework conventions

### Entry points

| Ecosystem | Marker | Reliability |
|---|---|---|
| Swift | `@main` on a type, or `main.swift` | SE-0281 guarantees exactly one of the two. **But** `@main` requires `static func main()`, which *"can be provided by the type itself, inherited from a superclass, or declared in an extension to a protocol the type conforms to"* — so knowing what **kind** of program it is requires resolving a conformance. Parsing gets you "there is an entry point and its type is spelled `App`"; it cannot confirm `App` is SwiftUI's |
| JS/TS | `bin` + shebang, `exports`, `main`, `module` | declarative, Read tier |
| Go | `package main` + `func main()` | trivially parseable; `go list -json` gives `Name: "main"` |
| Rust | `[[bin]]` targets in `cargo metadata`, `src/main.rs` | declarative |
| Python | `[project.scripts]` / `entry_points.txt`, `if __name__ == "__main__"` | declarative for installed dists |
| Container | `ENTRYPOINT`/`CMD`/`EXPOSE` | fully static |
| Android | `MAIN`/`LAUNCHER` intent filter | fully static |
| CI | workflow `run:` steps | fully static — and the only one that says which entry points *matter* |

### Routes — the clean split

The atlas's most tempting claim is "here are the endpoints." It is derivable for roughly half of the
web frameworks and not at all for the other half.

| Framework | Verdict | Source |
|---|---|---|
| **SvelteKit** | **Filesystem**, most complete of any: `+page`/`+layout`/`+server.js` (exporting `GET POST PUT PATCH DELETE OPTIONS HEAD`), `[param]`, `[[optional]]`, `[...rest]`, `(group)`, `[param=matcher]`, layout-breakout `+page@segment` | svelte.dev/docs/kit/routing |
| **Nuxt** | **Filesystem**, fully — and the **HTTP method is in the filename** (`users.get.ts`) | nuxt.com/docs/4.x/guide/directory-structure/server |
| **Next.js App Router** | **Filesystem for paths + AST for methods.** `route.ts` exports `GET…OPTIONS` as named exports, and segment config (`dynamic`, `revalidate`, `runtime`) is a literal named export. Note `middleware` is **deprecated and renamed to `proxy` as of v16.0.0** | [file conventions](https://nextjs.org/docs/app/api-reference/file-conventions) |
| **Astro** | **Split** — static routes from the filesystem; dynamic ones need `getStaticPaths()` to **execute** | docs.astro.build/en/guides/routing/ |
| **React Router v7 / Remix** | **Depends on mode.** File-based routing is **not the default** — it needs `@react-router/fs-routes` and `flatRoutes()` in `app/routes.ts`. Default is an executed config module | reactrouter.com/how-to/file-route-conventions |
| **TanStack Router** | **Generator must run** — conventions produce `routeTree.gen.ts` via a bundler plugin | tanstack.com/router |
| **NestJS / Spring Boot** | **AST-derivable** from literal decorators/annotations (`@Controller` + `@Get`, `@RestController` + `@RequestMapping`). Defeated by `setGlobalPrefix`, versioning, dynamic modules | docs.nestjs.com/controllers |
| **Express / Koa** | **Needs runtime.** Routes are imperative calls; prefixes compose at runtime, paths can be variables, routers mount in loops. **The routing guide documents no API to enumerate the route table** | expressjs.com/en/guide/routing.html |
| **Fastify** | **Needs runtime, but is introspectable** — `printRoutes()` / `printPlugins()`, both *"inside or after a `ready` call"* | fastify.dev/docs/latest/Reference/Server/ |
| **tRPC** | **Type-level, not filesystem.** Routers are plain value objects with no filesystem convention; the structure lives in `type AppRouter = typeof appRouter` — recoverable by the TS checker, not by globbing | trpc.io/docs/server/routers |
| **Rails** | **Needs runtime.** `config/routes.rb` is Ruby; `resources :photos` expands to seven routes only by executing it. `bin/rails routes` boots the app | guides.rubyonrails.org/routing.html |
| **Angular** | **Needs AST/runtime** — `Routes` arrays passed to `provideRouter()` | angular.dev/guide/routing/define-routes |

### SwiftUI — what a framework detection actually licenses

Measured over Argo's 454 first-party Swift files:

| Signal | Files | Reading |
|---|---:|---|
| `import SwiftUI` | 169 | SwiftUI-first |
| `: View` | 115 | — |
| `@Environment` | **87** | DI is via environment, heavily |
| `@State` | 50 | — |
| `@Observable` | **5** | modern Observation |
| `ObservableObject` | **0** | **no Combine-era model at all** |
| `NSViewRepresentable` | 1 | almost no AppKit embedding |

**What this genuinely licenses:** `@Observable` = 5 against `ObservableObject` = 0 is a clean,
high-confidence *vintage* signal — post-Observation with zero Combine-era holdover, consistent with
`MACOSX_DEPLOYMENT_TARGET = 26.0`. The 87:50 `@Environment`:`@State` ratio is a real architectural
fingerprint: dependency injection dominates local state ownership.

**What it does not license:** `: View` = 115 is **not a component count.** SwiftUI's `body`
composes, so one conformance may render a whole screen or one label — counting conformances measures
*file organisation*, not UI surface. And `: View` matched by grep is a **syntactic** match; nothing
confirms `View` is SwiftUI's rather than a local protocol of the same name.

**[unverified: `developer.apple.com` documentation pages are JS-rendered and could not be fetched,
so there are no verbatim Apple quotes for `App`/`Scene`/`View`/`@Environment`/`@Observable`
semantics. The counts are measured; the framework-semantics inferences are mine.]**

---

## 6. Tests as behaviour descriptions

The most interesting result in the survey, because the answer inverts the usual assumption: **the
newer and better the test framework, the less statically enumerable it is.**

### Swift: swift-testing is not statically enumerable, by design

Argo splits cleanly and visibly: unit tests are 100% swift-testing (`import Testing` in 158 files,
**1,120 `@Test` occurrences**, zero `XCTestCase`); the E2E target is 100% XCTest.

Per swift-testing's own `Documentation/ABI/TestContent.md`, tests live in a **linker section**
(`__DATA_CONST,__swift5_tests` on Mach-O), and each record holds **not a name but an accessor
function** that constructs the `Test` at runtime. Three things in this very repo defeat static
enumeration:

- **`@Test(arguments:)`** — e.g. `@Test(arguments: [CheckoutProjection.Head.branch("main"), …])`.
  Arguments are evaluated lazily, and swift-testing's own source notes `uncheckedTestCases` exists
  *"if you are implementing `swift test list`"* — so **even `swift test list` reports parameterized
  tests at function granularity, not case granularity.**
- **`.enabled(if:)`** — `@Suite("Live permission gate", .enabled(if: LiveCLI.isEnabled))`. The
  condition is an autoclosure, *"evaluated each time … and is not cached."* Confirmed empirically:
  **`swift test list` listed all three tests of a conditionally-disabled suite. Listing ≠ what will
  run.**
- `#if`-gated tests, and tests emitted by other macros (no `@Test` to grep).

`swift test list` is real (**6.4s warm, and it builds the test target first**) and preserves custom
display names verbatim: ``ArgoEngineTests.WorkspaceReaderTests/`a detached HEAD names no branch`()``.
`xcodebuild -enumerate-tests` exists too, with `-test-enumeration-style hierarchical|flat` and
`-test-enumeration-format text|json` — but needs a **built test bundle** and a `-destination`. The
`.xctestrun` plist contains **no test names**, confirming enumeration must load the bundle.

XCTest by contrast is genuinely greppable — `func test*` on an `XCTestCase` subclass is a name
convention, not a runtime identity — but still incomplete (inherited tests, `#if`, unlinked
targets).

### JS: the tradeoff, demonstrated

| Command | Executes test files? | Gives test *names*? |
|---|---|---|
| `jest --listTests` | **No** — pure globbing (a top-level `console.log` did not fire) | No, files only |
| `vitest list` | **Yes** | Yes, resolved |
| `vitest list --static-parse` | **No** | Yes, **unresolved** |
| `playwright test --list` | **Yes** (verified — a top-level `console.log` printed) | Yes, with file:line |
| `node --test` | Yes, full run | Yes |

The cleanest demonstration, same file, vitest 4.1.10:

```
$ vitest list                 # executes: unrolls the loop
outer suite > does x dynamically
outer suite > does y dynamically

$ vitest list --static-parse   # AST only: one entry, raw source
outer suite > does ${c} dynamically
```

**Four things defeat a static AST extractor, all confirmed:** template literals, `test.each` (one
AST node → N tests, all at the same line:column), names from variables, and generated suites. Also
invisible to AST: skip/todo status, conditional registration, and `it()` calls inside an imported
helper.

**The consequence for the atlas:** test names are a genuinely rich behaviour description — often the
*only* prose in a doc-less repo written by someone stating intent — but **statically extracted test
names are a lower bound with unknown error**, and runner-extracted names cost a full build plus
every side effect the test files have at module scope.

---

## 7. Public API surface

Ranked by what they cost.

| Route | Ecosystem | Requires | Gives |
|---|---|---|---|
| `package.json` `exports` | JS/TS | nothing | the author's *declaration* of the surface; absence means everything is public |
| `swift symbolgraph-extract` | Swift | a built module (0.15s once built) | every public symbol with USR, signature, access level, doc comment, and 8 relationship kinds |
| `tsc --emitDeclarationOnly --declaration --allowJs` | JS/TS | `typescript` only | a typed API surface **synthesised from JSDoc** for plain JavaScript |
| `checker.getExportsOfModule` + `typeToString` | JS/TS | a program | the same, programmatically, per module |
| [api-extractor](https://api-extractor.com) | TS | a build producing `.d.ts` | an **API report** (`.api.md`) for review workflows, a `.d.ts` rollup, and a doc-model `.api.json` with type signatures and doc comments |
| [typedoc](https://typedoc.org) `--json` | TS | a program | *"a JSON file containing all of the reflection data"* |
| `griffe dump` | Python | AST or import | JSON of modules/classes/functions/signatures/docstrings |
| `swift-api-digester -dump-sdk` | Swift | a built module | resolved conformances and parameter types, but **no doc comments and no Swift source locations** |
| `jdeps` | JVM | compiled bytecode | package/class dependency edges |

**What none of them tell you: which exports matter.** A module with 40 exports gets 40 equal
entries. That ranking is the LLM's job, and the honest inputs to it are usage counts from an index
and import counts from a graph — not the API dump itself.

Two dead-code tools bear on this. [Knip](https://knip.dev) reports unused files, dependencies,
exports and exported types, with 182 framework plugins for entry-point inference.
[Periphery](https://github.com/peripheryapp/periphery) does the same for Swift and **requires a
build** (it needs the index store). Its README is unusually candid about false positives:
Objective-C dynamism, `Codable`/`Equatable` synthesis, protocol conformances, raw-value enums,
assign-only properties, and `#if` (*"will only have visibility into the branches that are
compiled"*). **Treat "unused" as a hypothesis, never a fact.**

---

## 8. Import graphs, per ecosystem

| Tool | Coverage | Needs | Notes |
|---|---|---|---|
| [dependency-cruiser](https://github.com/sverweij/dependency-cruiser) | JS, TS, CoffeeScript, LiveScript; ESM/CJS/AMD; `.jsx .tsx .vue .svelte` | **no compile, no run** — pure AST | Also **validates architectural rules** (forbidden/allowed zones), which makes it both an extractor and a statement of intent. Outputs err/dot/json/csv/html/mermaid/archi |
| [madge](https://github.com/pahen/madge) | JS (CJS/AMD/ES6), TS via `tsConfig`, Sass/Stylus/Less | no build | `--json`, dot/SVG, `.circular()`. Documented limits: dynamic TS imports need `skipAsyncImports`, type-only imports need `skipTypeImports` |
| `esbuild --metafile` | JS/TS | a bundle | **the strongest single artifact on the JS side**: resolved edge paths, edge **`kind`** (`import-statement`/`require-call`/`dynamic-import`/`import-rule`/`url-token`), an **`external` flag** separating first-party from third-party, per-file byte weight, entry point per output, named exports |
| `webpack --json` | JS/TS | a full real build | richer than its own docs: `issuer`, `depth`, `usedExports`, `providedExports`, `reasons` with import-site `loc` |
| `go list -deps` | Go | a module | first-party |
| `cargo metadata` / `cargo tree` | Rust | manifest only | package-level, not module-level |
| `jdeps` | JVM | bytecode | package or class level |
| `swift-boundaries.sh`-style import grep | Swift | nothing | Argo's own gate proves import-level structure extraction is practical enough to be CI |

**What every one of them misses:** runtime wiring. DI containers, string-keyed registries,
non-literal `import()`, message buses, HTTP calls between packages, and anything crossing a process
boundary. **An import graph is a lower bound on coupling and says nothing about direction of
intent.**

---

## What an atlas node can honestly claim from derived signal alone

This is the part the node question hangs on. Mapping onto Argo's existing
[honesty tier](../domain/honesty-tier.md) vocabulary, derived repo signal splits three ways — and
the third is a tier Argo does not currently have.

### Tier A — read verbatim from an artifact the repo owns (DERIVED, verbatim)

The repo *declares* these. A node can state them flatly, and re-derive them cheaply on every
refresh. No rewording, no summarising — the same rule that already governs a Work Item's answer.

- **The package/target/module list**, with paths, kind (library/executable/test) and inter-target
  edges — from the manifest.
- **Third-party dependencies** with resolved versions, from the lockfile.
- **Entry points** where they are declarative: `bin` + shebang, `[[bin]]`, `@main`/`main.swift`,
  `ENTRYPOINT`/`CMD`, `MAIN`/`LAUNCHER`, `[project.scripts]`.
- **The declared public surface**, where `exports`/`files` or an access-level filter defines it.
- **The route table**, for SvelteKit, Nuxt, Next.js paths, and any repo committing an OpenAPI,
  protobuf or GraphQL SDL file — in that last case the schema *is* the node.
- **What the project considers green**: the CI job graph and the literal commands each job runs.
- **Declared first-party roots and exclusions**: lint `included:`/`excluded:`, linguist
  `.gitattributes` overrides, `CODEOWNERS` (as *policy*, never as authorship).
- **Repo shape**: first commit in this history, commit cadence, tag/release history, merge ratio.

### Tier B — computed, and true only with its method attached (DERIVED, inferred)

Every one of these is a *number produced by a procedure*, and the procedure's parameters change the
number. A node may claim them **only if it also carries how it computed them**, exactly as Argo
already renders external liveness and `~n%` context as DERIVED soft-spots rather than hiding them.

- **Import/dependency edges.** A lower bound. Misses all runtime wiring. On the JS side, edge
  *kind* (`static｜dynamic｜implicit` from Nx, or esbuild's `kind`) is itself part of the claim.
- **Type and conformance facts.** Only from a successful build. **Absence of a reference is not
  evidence of absence** — SourceKit-LSP and tsserver both answer `[]` when unindexed, and CJS breaks
  call hierarchy specifically.
- **Hot spots.** Meaningless without stating the simplification mode; the same file yields 426 or
  1,681 commits depending on flags.
- **Co-change coupling.** In a squash-merge repo it measures **PR scope**, not design coupling. Argo
  squash-merges. This must be said, not silently rendered as a coupling.
- **Ownership and authorship.** Without a `.mailmap`, wrong by an unbounded and *directional* factor.
  Bot trailers compound it.
- **Test inventories.** Static extraction is a lower bound with unknown error (parameterized cases,
  template names, generated suites); `swift test list` lists conditionally-disabled tests that will
  never run.
- **Dead code.** A hypothesis. Periphery's and Knip's own docs enumerate the false positives.
- **Framework fingerprints.** `@Observable`=5 / `ObservableObject`=0 is a strong vintage claim;
  `: View`=115 is not a component count.

### Tier C — always the LLM

Nothing in the extraction stack produces any of these. They are not "hard to derive"; they are **not
present in the artifacts at all.**

- **Why anything exists.** Purpose, responsibility, the problem a module solves. A manifest says a
  target exists; nothing says what it is for.
- **What the layers are, and which direction is "up."** Import edges are undirected in intent. The
  only machine-readable statement of layering is when someone wrote it down as a lint rule — and
  most repos have not.
- **Which of 40 exports matters.** Every API dump ranks them equally.
- **Whether a hot spot is rotten or central.** The metric cannot separate a decaying module from a
  router table.
- **What a flow is.** "How a request becomes a response," "what happens when a Session goes idle" —
  a path through the graph that a person would recognise as a story. The graph contains all such
  paths; nothing marks which ones are meaningful.
- **What is idiomatic here versus incidental.** Conventions a codebase follows without naming.
- **Every word of narratable prose.** The [#643 map](https://github.com/milad-alizadeh/argo/issues/643)
  requires every node to read aloud cleanly. No extractor emits a sentence.
- **The naming of anything.** A node called "the permission gate" is an inference; the derived facts
  underneath it are five files and a protocol conformance.

### The consequence for the node

**A node is a derived skeleton with an inferred skin, and the two must stay separately addressable.**
Tier A and B facts are re-derivable per commit at a known cost; Tier C prose is expensive, stale the
moment the code moves, and unverifiable. If a node stores them as one blob, a refresh cannot tell
which half went stale, and the atlas will re-render confident prose over facts that changed.

Which suggests two follow-on constraints, both for the node ticket rather than this one:

1. **Every claim carries its tier and, for Tier B, its method.** A node that says "12 files, 3
   inbound imports" and a node that says "the seam where the cockpit reads Hub state" are different
   kinds of assertion and must not render identically.
2. **Degrade-down applies unchanged.** A Project with no build, a shallow clone, an unindexable
   stack, or a language with no parser degrades to Tier A only — a real, useful, honest atlas made of
   manifests, CI config, filesystem shape and git history. That is the floor, it is reachable on
   literally any repo in seconds, and it is a great deal more than nothing.

---

## Suggestions going forward

1. **Build the Tier A extractor first and ship it alone.** Manifests + CI + filesystem + git shape,
   with an incremental `<sha>..HEAD` refresh, is seconds of work on any repo and needs no toolchain,
   no build, and no language server. It is also the only tier that works on an untrusted repo
   without executing its code.

2. **Treat "can I build this?" as an explicit atlas state, not a failure.** The Resolve tier is a
   different product: 847MB of `.build` for Swift, a full `tsc` program for TS, a compiled classpath
   for the JVM. Whether Argo pays that per Project — and when — is a real decision, and the answer
   is probably "on demand, per node, not on registration."

3. **Guard the two silent-failure modes before anything else.** `git rev-parse
   --is-shallow-repository` before any history analysis, and `languageServiceDisabled` /
   empty-result checks before treating any LSP `[]` as a fact. Both produce confident wrong answers
   otherwise, which is exactly the false DIRECT ADR-0008 forbids.

4. **Harvest the repo's own declarations of intent.** Lint `included:`/`excluded:` roots,
   `import/no-restricted-paths` zones, `CODEOWNERS`, linguist overrides, and CI job names are the
   closest thing a doc-less repo has to authored architecture, and they cost nothing to read. This
   is where the atlas should look *before* it starts inferring.

5. **Resolve [#644](https://github.com/milad-alizadeh/argo/issues/644)** with the three-tier split
   above as the answer, and carry the Tier A / Tier B / Tier C distinction directly into the node
   ticket — the node's shape should make it impossible to store a Tier C sentence where a Tier A
   fact belongs.

---

## What could not be verified

- **The cross-language strand (tree-sitter, SCIP indexer maturity, ctags fields, ast-grep/Semgrep
  coverage, Stack Graphs, Glean, tokei/scc)** is the thinnest section here — the agent assigned to
  it did not return. `sourcegraph/scip`'s indexer list and the absence of a Swift indexer are cited;
  everything else in §2 marked `[unverified]` is from memory.
- **Apple's protocol documentation** — `developer.apple.com` serves JS-rendered SPAs that WebFetch
  cannot read. No verbatim quotes for SwiftUI's `App`/`Scene`/`View` semantics.
- **GraphQL** — both `graphql.org` and `spec.graphql.org` returned 403.
- **SwiftPM manifest sandboxing** — evidenced only by the `--disable-sandbox` flag in `--help`.
- **IndexStoreDB's `SymbolRole` case list**; the symbol graph's dependence on `.swiftsourceinfo`
  for locations (inferred, not tested); `tuist graph` on a non-Tuist project; Bazel support in
  SourceKit-LSP.
- **Syft's JavaScript cataloger** — whether it reads `bun.lock`/`pnpm-lock.yaml` is unconfirmed, and
  is the most consequential gap for non-npm JS repos.
- **rustdoc JSON's stability/nightly status**; `bun.lock`'s exact syntax; `jest --listTests --json`
  (works, undocumented); webpack stats fields present in real output but absent from the docs.
- **The 100k-commit git timing** is extrapolated from a 9,833-commit measurement, not measured.
- All timings are warm, on Apple silicon. Cold-checkout costs are higher and several commands need
  network for dependency resolution.

One methodological note worth keeping: an automated read of Playwright's docs asserted that `--list`
does not execute test files. Running it proved otherwise. **Where a claim is about behaviour, settle
it by execution, not by reading.**
