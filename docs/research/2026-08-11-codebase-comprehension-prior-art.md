# Codebase comprehension and onboarding tools — prior art

**Date:** 2026-08-11 · **For:** [#645](https://github.com/milad-alizadeh/argo/issues/645), part of the
Project Atlas map [#643](https://github.com/milad-alizadeh/argo/issues/643) ·
**Status:** survey, feeds [#646](https://github.com/milad-alizadeh/argo/issues/646) (what a node is),
[#648](https://github.com/milad-alizadeh/argo/issues/648) (how a person moves),
[#649](https://github.com/milad-alizadeh/argo/issues/649) (honesty tier and freshness)

**Method:** five parallel research passes against primary sources — vendor docs, the tools' own
repos and commit history, changelogs, shutdown notices, papers, `web.archive.org` for the dead
ones — plus a sixth pass on doc-sync tools done in-session. Community evidence (HN, Reddit,
review sites, practitioner blogs) is marked **[community]** wherever it carries a claim. Where a
widely-repeated fact could not be pinned to a primary source it is listed under *Unverified* at
the end rather than stated.

## The one-paragraph answer

Twenty years of tools have converged on the same three-way trade and nobody has escaped it.
**Depth costs setup** — symbol-accurate models need a compiling build, so they end up as manual-
refresh desktop apps (Sourcetrail, Understand). **Freshness costs depth** — CI-regenerated maps
stay current by keeping the unit shallow, files and imports (CodeSee). **Meaning costs a human** —
anything that says what a system is *for* is hand-authored, and hand-authored artefacts rot
(Sourcegraph Notebooks, Structure101 specs, Backstage YAML, arc42, C4 component diagrams). The
LLM era changed which of the three you pay, not that you pay: generation is now free, so the
binding constraint moved to **trust**, and every vendor answered trust the same way — a citation
back to source — while **not one of them ships a staleness indicator, an as-of-commit stamp, or a
confidence signal**. That is the hole.

---

## The inventory

Every tool researched, including the dead ends. Cells are deliberately terse; the evidence is in
the section each row links to. `?` means could not verify — those are collected under
[Unverified](#unverified).

| Tool | Status | Unit of knowledge | Drill-in | Freshness | Setup | Where it falls down |
|---|---|---|---|---|---|---|
| **[DeepWiki](https://deepwiki.com/)** ([§](#deepwiki)) | Live — launched 5 May 2025 ([Cognition blog](https://cognition.com/blog/deepwiki)) | Wiki page per subsystem; persisted Q&A | Page tree; citation → file+lines; follow-up box | **Badge-gated** — *"We auto-refresh DeepWikis if their repo has a badge"* ([repo](https://github.com/CognitionAI/deepwiki)); private = manual index | Zero (swap URL); optional `.devin/wiki.json` | Confident fabrication; file size read as importance; no opt-out; reads code only, never the *why* |
| **[Windsurf Codemaps](https://cognition.com/blog/codemaps)** ([§](#windsurf-codemaps)) | Live — Nov 2025; Windsurf folded into Devin Desktop | Task-scoped node map with line numbers | Node → editor; `@{codemap}` in agent | N/A — disposable per task | Devin Desktop | Nothing persists; no shared artefact |
| **[Google Code Wiki](https://codewiki.google/)** ([§](#google-code-wiki)) | Preview, public repos only — 13 Nov 2025 ([Google blog](https://developers.googleblog.com/introducing-code-wiki-accelerating-your-code-understanding/)) | Wiki page per module + diagrams + repo chat | Prose links → file/class/fn; cited chat | *"regenerates after each change"* — mechanism `?` | Zero; private repos unavailable | Regeneration destroys the referent; "wall of text"; not editable |
| **[Mutable.ai Auto Wiki](https://news.ycombinator.com/item?id=38915999)** ([§](#mutableai-auto-wiki)) | **Dead** — domain fails DNS (checked 2026-08-11), no shutdown notice; team → Google Code Wiki ([HN 45926350](https://news.ycombinator.com/item?id=45926350)) | Wikipedia-style article per module | Article links; v2 chat did RAG **over the wiki** | Regenerate | Zero | Fabricated paragraphs; verification cost > writing cost; can't get "why" from code |
| **[deepwiki-open](https://github.com/AsyncFuncAI/deepwiki-open)** ([§](#deepwiki-open-and-oss-clones)) | Live OSS — MIT, ~17.6k stars | Wiki pages + diagrams; newer "codemap" | Page tree + RAG chat | **Broken** — regenerates from stale vector cache ([#371](https://github.com/AsyncFuncAI/deepwiki-open/issues/371)) | Self-host, Docker, own API keys | Cache layer; token cost and rate limits; retrieval gaps on large trees |
| **[OpenDeepWiki](https://github.com/AIDotNet/OpenDeepWiki)** ([§](#deepwiki-open-and-oss-clones)) | Live OSS — MIT, ~3.5k stars | Same as DeepWiki | Page tree + chat | Regenerate | Self-host | Small; same generation problems |
| **[Repomix](https://github.com/yamadashy/repomix)** ([§](#deepwiki-open-and-oss-clones)) | Live OSS — ~27.8k stars | One packed file of the whole repo | None — you paste it into a model | N/A — run it again | `npx repomix` | No artefact, no navigation; context-window bound |
| **[Copilot Spaces](https://docs.github.com/en/copilot/concepts/context/spaces)** ([§](#llm-era-ide-and-vendor-features)) | Live — GA 24 Sep 2025 ([changelog](https://github.blog/changelog/2025-09-24-copilot-spaces-is-now-generally-available/)) | Human-curated bundle of sources + instructions | Chat over the bundle | *"automatically updated as they change"* for GitHub sources; uploads are snapshots | Minutes; any Copilot licence | Was capped at 50 files; no IDE access at launch; still human-curated |
| **[VS Code `@workspace`](https://code.visualstudio.com/docs/agents/reference/workspace-context)** ([§](#llm-era-ide-and-vendor-features)) | Live | Workspace index: text, tree, symbols | Chat; `#codebase` | Background local semantic index; remote via GitHub | Zero; off by default for orgs | **2,500-file cap** then falls back to sparse; stuck/never-completing builds |
| **[Copilot repo indexing](https://docs.github.com/en/copilot/concepts/context/repository-indexing)** ([§](#llm-era-ide-and-vendor-features)) | Live — GA 12 Mar 2025 ([changelog](https://github.blog/changelog/2025-03-12-instant-semantic-code-search-indexing-now-generally-available-for-github-copilot/)) | Semantic code-search index | Copilot Chat on github.com | **Best claim in the survey** — updated *"within seconds of you starting a new conversation"* | Zero — opening chat triggers it | No human-facing artefact; answers only |
| **[Copilot code review](https://docs.github.com/en/copilot/concepts/agents/code-review)** ([§](#llm-era-ide-and-vendor-features)) | Live — GA 4 Apr 2025; **agentic since 5 Mar 2026** ([changelog](https://github.blog/changelog/2026-03-05-copilot-code-review-now-runs-on-an-agentic-architecture/)) | A review comment on a diff | Inline on the PR | No index — gathers context per call | Zero | GitHub chose *not* to consume a prebuilt index for its highest-volume comprehension task |
| **[Cursor indexing](https://cursor.com/docs/context/codebase-indexing)** ([§](#llm-era-ide-and-vendor-features)) | Live | AST-sized embedded chunks (~500 tokens) | `@`-mentions; agent search | **Merkle tree of SHA-256 hashes** — walks only differing branches ([blog](https://cursor.com/blog/secure-codebase-indexing)) | Automatic on opening a folder | Stuck indexes; stale after renames/moves with the AI citing old structure |
| **[Windsurf / Devin Desktop](https://docs.devin.ai/desktop/context-awareness/overview)** ([§](#llm-era-ide-and-vendor-features)) | Live — Cognition acquired Windsurf Jul 2025 | RAG over embedded workspace index | `@`-mentions | Local: on edit. **Remote (Enterprise): every N days** ([docs](https://docs.devin.ai/desktop/context-awareness/remote-indexing)) | 5–10 min initial; ~300MB RAM / 5k files | Recommended cap ~10,000 files; remote index stale by design |
| **[Zed semantic index](https://github.com/zed-industries/zed/releases/tag/v0.128.3)** ([§](#llm-era-ide-and-vendor-features)) | **Removed** — Mar 2024, *"temporarily removing the semantic index in order to redesign it from scratch"*; never returned (no `semantic_index` crate in `main`) | — | — | — | — | Deliberate negative result: Zed now argues agentic search beats an index — *"I didn't have to … wait for an indexing process to finish"* |
| **[Amazon Q `/doc`](https://aws.amazon.com/about-aws/whats-new/2024/12/amazon-q-developer-generate-documentation-source-code/)** ([§](#llm-era-ide-and-vendor-features)) | **Being killed** — signups blocked 15 May 2026, ends 30 Apr 2027 ([AWS](https://aws.amazon.com/blogs/devops/amazon-q-developer-end-of-support-announcement/)) | A README committed into your repo + diagrams | None — review a diff, accept | **Manual** — re-run `/doc` | Q extension; README ≤15KB, project ≤200MB | README only, root only; no navigation at all |
| **[Kiro](https://kiro.dev/docs/steering/)** ([§](#llm-era-ide-and-vendor-features)) | Live — the Q successor | `.kiro/steering/` docs; generated READMEs | File links | **Agent hooks on file-save** regenerate docs | You author the hook | Freshness bought by making the user build the mechanism |
| **[JetBrains Junie](https://blog.jetbrains.com/junie/2026/06/junie-coding-agent-out-of-beta/)** ([§](#llm-era-ide-and-vendor-features)) | Live — out of beta Jun 2026 | None of its own — borrows the IDE's index | IDE navigation | **Best freshness, free** — the IDE indexes continuously anyway | Zero | No artefact; IDE-bound |
| **JetBrains AI Assistant "Codebase mode"** ([§](#llm-era-ide-and-vendor-features)) | Live | Chat over gathered context | Chat | **Re-gathers context every new chat** instead of caching | Zero | Multi-minute waits; users turn it off — [LLM-22301](https://youtrack.jetbrains.com/projects/LLM/issues/LLM-22301/) **[community-reported]** |
| **[JetBrains Context](https://blog.jetbrains.com/ai/2026/07/introducing-jetbrains-context-repository-intelligence-for-coding-agents/)** ([§](#llm-era-ide-and-vendor-features)) | EAP — Jul 2026 | Semantic chunks, multi-repo, for foreign agents | Agent tool call | Incremental at session start; **index expires 14 days** after last search | `jbcontext index` or a hook | JetBrains conceding the IDE index can't reach other agents |
| **[Qodo Aware](https://qodo.ai/blog/introducing-qodo-aware-deep-codebase-intelligence-for-enterprise-development/)** ([§](#llm-era-ide-and-vendor-features)) | Live — 10 Sep 2025 | Answers: Ask, Deep Research, Issue Finder | Chat / MCP | `?` — no refresh trigger documented anywhere fetchable | Free MCP over ~100 OSS repos; enterprise demo-gated | Its own PR is the loudest voice; no community signal |
| **[Augment Context Engine](https://www.augmentcode.com/blog/context-engine-mcp-now-live)** ([§](#llm-era-ide-and-vendor-features)) | Live as MCP — GA 6 Feb 2026; **completions sunset 31 Mar 2026** ([changelog](https://www.augmentcode.com/changelog/planned-march-31-sunset-for-next-edit-and-completions)) | One tool, `codebase-retrieval` — no human artefact | Agent tool call only | **Best-specified**: local real-time watch; remote re-indexes **on push to default branch**; Context Lineage indexes git history with per-diff summaries | MCP server | Killed its human-facing product; ~$0.03–0.06/query |
| **[Unblocked](https://getunblocked.com/)** ([§](#8-docs-that-stay-in-sync-with-code)) | Live — $20M Series A May 2025 | Synthesized answer across code + Slack + Jira + docs, with sources | Chat / MCP | Synced as the team pushes; webhook-vs-cron `?` | Heaviest of the alive set — connect every system | Weak public footprint; the reader is increasingly a model |
| **[Greptile](https://www.greptile.com/)** ([§](#llm-era-ide-and-vendor-features)) | Live — **pivoted off Q&A to code review**; docs index has no query/search/chat endpoint | A review comment | On the PR | Per-PR | GitHub app | Founder on the original Q&A, 2024: *"Haven't figured out what should trigger updates"* ([HN 39604961](https://news.ycombinator.com/item?id=39604961)) |
| **Onboard AI** ([§](#llm-era-ide-and-vendor-features)) | **Renamed** to Greptile ~early 2024 (undocumented by the company); `getonboardai.com` cert expired, checked 2026-08-11 | Codebase Q&A | Chat | `?` | GitHub OAuth | Became Greptile, which then abandoned the Q&A product |
| **[Bloop](https://github.com/BloopAI/bloop)** ([§](#llm-era-ide-and-vendor-features)) | **Dead twice** — repo archived 2 Jan 2025; company shut 10 Apr 2026 ([HN 47718190](https://news.ycombinator.com/item?id=47718190)) | Semantic code search results | Chat + search | Local index | Desktop app; BYO key | *"ML-based search methods for code are just not that useful"*; no moat; OAuth scope friction **[community]** |
| **[Ellipsis](https://www.ellipsis.dev/)** ([§](#llm-era-ide-and-vendor-features)) | Live — pivoted review → "Agent Cloud" Jul 2026 | A review comment / agent run | On the PR | Per-PR | GitHub app | Left comprehension entirely |
| **[Komment](https://komment.ai/)** ([§](#8-docs-that-stay-in-sync-with-code)) | Live but invisible — 1 HN post, 2 points | Inline comments → API docs → diagrams → per-repo wiki | Wiki links | **The design worth stealing** — re-documents on detected **divergence between code and docs** | VPC self-host or hosted | Essentially zero adoption; no community evidence either way |
| **[Driver.ai](https://www.driver.ai/)** ([§](#8-docs-that-stay-in-sync-with-code)) | Live — $8M seed led by GV, Oct 2024 | **Symbol-complete** docs, architecture docs, commit-complete changelogs, code map | Primarily MCP; human reading secondary | **Commit-scoped partial updates** to only affected docs | Connect repo | Zero HN footprint; the human reader is an afterthought |
| **[CodeSee](https://web.archive.org/web/20240309043453/https://www.codesee.io/)** ([§](#2-codesee)) | **Dead** — shut down 22 Feb 2024 (homepage banner); assets acquired by GitKraken 14 May 2024 ([GitKraken](https://www.gitkraken.com/blog/gitkraken-launches-devex-platform-acquires-codesee)); codesee.io now 404s | File/folder node + import edge; tours and labels layered on top | Expand/collapse canvas; click node → code; overlays; Tours | **Solved it** — GitHub Action on push + `pull_request_target` | ~3 min: app auth, workflow, secret | Company failure: inconsistent sales, unfundable language breadth, GenAI, declined term sheet. **No community ever formed** — no HN thread over 12 points in 4 years |
| **[Sourcegraph code search](https://sourcegraph.com/docs/code-search/code-navigation)** ([§](#3-sourcegraph)) | Live — the flagship again since Dec 2025 | File+line match; symbol occurrence | Query DSL → blob; hover/go-to-def | Repo sync, ~continuous | Instance + code-host connections | No unit above the symbol; a query only answers what you knew to ask |
| **Sourcegraph precise nav** ([§](#3-sourcegraph)) | Live | Compiler-accurate symbol | def / refs / impls | CI `src code-intel upload`, or auto-index ~24h/repo | Per-language SCIP indexer + executors + a build that compiles in a sandbox | The comprehension rung was the expensive one; the grep rung was free |
| **[Sourcegraph Notebooks](https://sourcegraph.com/blog/notebooks-ci)** ([§](#3-sourcegraph)) | **Removed** — 7.0, 25 Feb 2026 ([changelog](https://sourcegraph.com/changelog/7-0-removals-deprecations)); notepad removed Jan 2024; docs deleted Mar 2026 | Markdown + live search/file/symbol blocks | Click a block into live code | Queries re-run; **the prose does not** | Author it by hand | The explicit onboarding attempt. Killed for agent transcripts: *"the future lies much more in this type of agent-driven code exploration"* |
| **Sourcegraph Code Insights / Batch Changes** ([§](#3-sourcegraph)) | Live — both rebuilt around agents in 7.0 | A query plotted over time / a changeset across N repos | Point → results | Re-runs the query | Define a series / a spec | Not comprehension surfaces. Notable only because the *derived* surfaces lived while the *curated* ones were cut |
| **Sourcegraph Own / CODEOWNERS** ([§](#3-sourcegraph)) | **Removed** — 7.0, Feb 2026 | File owner | Ownership panel | CODEOWNERS sync | Upload or infer | *"With agents in the mix, ownership is blurrier than ever"* |
| **[Cody](https://sourcegraph.com/docs/cody)** ([§](#3-sourcegraph)) | **Free/Pro/Starter killed 23 Jul 2025** ([blog](https://sourcegraph.com/blog/changes-to-cody-free-pro-and-enterprise-starter-plans)); Enterprise-only | LLM answer + cited snippets | `@` file / symbol / repository | Live search per query — no index to go stale | Enterprise licence | **Removed embeddings for BM25** in Feb 2024 — a real negative result for RAG-over-code. *"any chat without a context chip will instruct Cody to use no codebase context"* |
| **[Amp](https://ampcode.com/news/amp-inc)** ([§](#3-sourcegraph)) | Live — spun out as Amp Inc. 2 Dec 2025 | Agent session | Chat | Live | Account | Cody's replacement; an agent, not a map |
| **[Sourcetrail](https://github.com/CoatiSoftware/Sourcetrail)** ([§](#4-sourcetrail)) | **Archived** — announced 23 Sep 2021 ([Discontinue Sourcetrail](https://web.archive.org/web/20210924004042/https://www.sourcetrail.com/blog/discontinue_sourcetrail/)); last release Nov 2021, repo archived Dec 2021 | **Symbol** + typed relations; bookmarks; **Custom Trail** (a saved A→B path) | Search symbol → graph re-centres; toolbar switches trail type; code pane in lockstep | **Manual** — `F5` incremental, `Shift+F5` full. No CI, no shared index | Highest: `compile_commands.json` for C/C++; Gradle/Maven for Java | Founders' own list: value not legible at first glance; procurement friction; 40% language coverage, >10 MLoC limits, and setup that hurt *"especially newcomers that would benefit the most"* |
| **[petermost/Sourcetrail](https://github.com/petermost/Sourcetrail)** ([§](#4-sourcetrail)) | Live fork — releases through 2025.12.8, ~750 stars | Same | Same | Same (manual) | Same | Inherits every limit; a community keeping the lights on |
| **[SciTools Understand](https://scitools.com/)** ([§](#5-scitools-understand)) | **Live** — 8.0, May 2026 ([build notes](https://support.scitools.com/support/solutions/articles/70000684071-understand-build-8-0-1254)) | **Entity + reference**, plus **Architectures** — a human-authored decomposition metrics report against | Entity → references bidirectionally; a dozen graph types; Python API | Manual but automatable: watched dirs, `und … analyze`, **DevOps/CI licence SKUs** | Project + per-language parsers; import the real build for C/C++ accuracy | Didn't fail — retreated. $100–120/dev/mo, sold on MISRA ~91% / AUTOSAR ~90% / secure-lab licensing. **The buyer is compliance, not the developer** |
| **[Structure101](https://www.sonarsource.com/structure101/)** ([§](#6-dependency-and-architecture-tools)) | **Acquired and discontinued** — Sonar, 15 Oct 2024; *"Will products still be available for sale?" — "No"* ([press release](https://www.sonarsource.com/company/press-releases/sonar-acquires-structure101-to-strengthen-code-quality-offering/)) | Containment model from **compiled artifacts**, fn → class → package → jar → layer, plus a virtual hierarchy | Double-click to expand/collapse any level on the Levelized Structure Map | Re-parse; IDE plugin could **fail the build** on a violating dependency | Point at jars, **then author the target architecture by hand** | The authoring tax; compiled-artifact input locked out JS/TS/Python/Go; enterprise-Java audience shrank |
| **[NDepend](https://www.ndepend.com/)** ([§](#6-dependency-and-architecture-tools)) | Live — v2026.1 | Queryable code model over .NET assemblies, interrogated with **CQLinq** | Query results → graph/matrix; trend charts | **Rebuilt every run**; Quality Gates are CQLinq queries and can **diff against a baseline** | Light — attach `.ndproj` to a `.sln` | Windows + VS + compiled .NET; a *separately paid* build-machine licence for the CI enforcement that is the point; CQLinq is a second language |
| **[CppDepend / JArchitect](https://www.codergears.com/releasenotes)** ([§](#6-dependency-and-architecture-tools)) | Live — both v2026.1 | Same as NDepend, other languages | Same | Same | Same | Far more obscure than the .NET original |
| **[Lattix](https://www.lattix.com/products/)** ([§](#6-dependency-and-architecture-tools)) | Live, quiet — docs show Release 2025 | DSM cell: subsystem→subsystem dependency count | Expand/collapse matrix rows | Re-import from build artifacts; CI checks design rules | Partition and rules **authored by hand** | A DSM is an architect's instrument most developers can't read untrained; same authoring tax |
| **[Sonargraph](https://www.hello2morrow.com/products/sonargraph)** ([§](#6-dependency-and-architecture-tools)) | Live — free Explorer tier; MCP support added | Architecture model + hundreds of metrics | Explore model; violations | Sonargraph-Build in CI; SonarQube plugin | **Architecture DSL as text in the repo** — the best-shaped version of the authored model | Same authoring tax; small vendor; most people stop at the free tier |
| **[CAST Imaging](https://www.castsoftware.com/products/imaging)** ([§](#6-dependency-and-architecture-tools)) | Live — MCP server GA 20 Nov 2025 ([news](https://www.castsoftware.com/news/cast-announces-early-access-to-cast-imaging-mcp-server)) | The **object** — code element, DB table, screen — and typed links, unified across 450+ techs | Portfolio → app → layer → **transaction** (entry point to data) → object | Periodic re-scan, not continuous | Analyzers per technology, source delivery, configuration | Sold to CIOs, not teams. *"the on-premise integration was challenging"*, *"rather high price point"* **[Gartner reviewers]** |
| **[CAST Highlight](https://www.castsoftware.com/highlight)** ([§](#6-dependency-and-architecture-tools)) | Live | Per-app scores: cloud readiness, health, OSS risk, SBOM | Portfolio dashboards | Re-scan | One lightweight scan per app | Portfolio governance, not comprehension |
| **[Moose / Pharo](https://moosetechnology.org/)** ([§](#6-dependency-and-architecture-tools)) | Live, academic — free/OSS | FAMIX metamodel entities | You build the browser | You build it | Pharo/Smalltalk fluency | *"enable the analyst to produce new dedicated analysis tools"* — a toolkit, not an analysis. No on-ramp |
| **[ArchUnit](https://github.com/TNG/ArchUnit)** ([§](#6-dependency-and-architecture-tools)) | Live — 3.8k stars, Apache-2.0, v1.5.0 | **None — you don't look at anything** | **No drill-in at all** | Free — CI runs the test every commit | Write an assertion in JUnit | Can only catch a rule you already knew to write. Cannot show you what the system looks like |
| **[dependency-cruiser](https://github.com/sverweij/dependency-cruiser)** ([§](#6-dependency-and-architecture-tools)) | Live — 7.1k stars, MIT | Rule violations; optional dot/mermaid graph | Read the report | CI on every commit | `.dependency-cruiser.js` rules | Same limit as ArchUnit |
| **[Deptrac](https://github.com/deptrac/deptrac)** ([§](#6-dependency-and-architecture-tools)) | Live — repo moved; `qossmic/deptrac` **archived 17 Feb 2025** after namespace rename | Layer rule violations | Read the report | CI | Layer/ruleset config | Same limit |
| **[Madge](https://github.com/pahen/madge)** ([§](#6-dependency-and-architecture-tools)) | Live but under-maintained — 10.1k stars; open issues report the cycle algorithm misses cycles ([#447](https://github.com/pahen/madge/issues/447)) | Module dependency graph; circular deps | Read the graph | Run it again | `npx madge` | Highest stars, weakest health in the cluster |
| **[Structurizr](https://docs.structurizr.com/eol)** ([§](#6-dependency-and-architecture-tools)) | **Cloud EOL 30 Sep 2026**; all workspaces read-only from 1 Jul 2026. Lite/on-prem open-sourced early 2023 | C4 diagrams from a model-as-code | Click through C4 levels | You update the model | Author the model in DSL/code | Brown's stated reason: *"engineering teams have consistently been reluctant to publish their software architecture diagrams to the cloud"* |
| **[C4 model](https://c4model.com/)** ([§](#6-dependency-and-architecture-tools)) | Live — a notation, not a product | System Context → Container → Component → Code | Zoom a level | **None** — its own [FAQ](https://c4model.com/diagrams/faq) says component diagrams *"may change frequently"* and code diagrams *"become outdated very quickly"* | Draw them | Brown's own answer is *don't draw the bottom two levels* — reverse-engineer them. He was still giving that talk at JFokus 2025 |
| **[arc42](https://arc42.org/overview)** ([§](#6-dependency-and-architecture-tools)) | Live — free template | A document section (12 of them) | Section 5 decomposes whitebox/blackbox | **None whatsoever** | Write twelve sections | Nothing derives it, nothing checks it. The one-page "canvas" is the tacit admission it's too heavy |
| **[CodeScene](https://codescene.com/)** ([§](#7-codescene)) | Live — €18–27 per active author/month | **A file with a history**, behaviourally ranked | Circle-packing map → file → **X-Ray** → per-function hotspots and coupling | **Per commit / per CI run**, plus Delta analysis on the PR | **Point it at a git repo. That's it.** No build, no annotations, no authored model | 0.9% mindshare **[PeerSpot]**; *"what do I do with it"* — it shows where the pain is, it doesn't authorise the refactor; cost scales with headcount |
| **[Code Maat](https://github.com/adamtornhill/code-maat)** ([§](#7-codescene)) | Dormant OSS — GPL-3.0, 2.6k stars; work moved into the product | VCS-mined metrics (coupling, churn, ownership) | CLI output → your own charts | Re-run | JVM + a git log | Feature-complete and parked; the books' teaching engine |
| **[Swimm](https://swimm.io/enterprise)** ([§](#8-docs-that-stay-in-sync-with-code)) | **Pivoted** — enterprise site now leads with *"Use secure AI to rapidly modernize your mainframe"*; dev-docs product no longer the headline | Markdown + snippets bound to code via smart tokens, as `.swm` files in the repo | Docs in IDE and web; "playlists" for onboarding paths | **Auto-sync on every commit** via GitHub App; re-anchors moved code, **fails the check when it can't** | Install the app; **then write the docs** | Its own limit: *"we can't document a negative."* Auto-sync catches mechanical drift, never semantic drift. And someone still has to write the doc |
| **[Mintlify](https://www.mintlify.com/)** ([§](#8-docs-that-stay-in-sync-with-code)) | Live | A docs page | Site nav + docs chat | Bi-directional git sync — i.e. whatever humans commit | `docs.json` + a repo | Dropped the code-sync ambition; 2026 investment is AI-readability (`llms.txt`, `skill.md`, MCP per site) |
| **[Backstage](https://backstage.io/docs/features/software-catalog/)** ([§](#8-docs-that-stay-in-sync-with-code)) | Live — CNCF | Catalog entity: Component, System, API, Domain, Resource | Catalog graph; TechDocs | **Hand-maintained `catalog-info.yaml`** — *"Teams owning the components are responsible for maintaining the metadata"* | Run a Backstage instance; write YAML per component | The cleanest instance of the authoring tax. **[community]** ~10% engineer adoption, 6–12 months to a usable instance, ≥1 dedicated engineer |
| **[CodeStream](https://docs.newrelic.com/eol/2026/05/eol-05-11-26-codestream/)** ([§](#8-docs-that-stay-in-sync-with-code)) | **EOL 5 Nov 2026** — New Relic | In-IDE discussion tied to code lines | Click a line marker | Discussion is durable, code moves | IDE extension + API key | Stated reason: *"In this AI era, CodeStream no longer provides the impact it once did"* |
| **[Stepsize](https://www.stepsize.com/)** ([§](#8-docs-that-stay-in-sync-with-code)) | `?` — site live, repositioned to AI sprint reports; no shutdown notice found | Tech-debt item tied to code | IDE plugin | Tied to the code it marks | IDE plugin | Could not verify current status of the IDE product |
| **Doxygen / Sphinx / JSDoc / TypeDoc** ([§](#8-docs-that-stay-in-sync-with-code)) | Live — all of them, for decades | API reference per symbol | Symbol index | Regenerated from source on build — **perfectly fresh** | A build step | Perfectly fresh and nearly useless: they document what the signature already says, not how the system works |
| **[ADRs](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)** ([§](#8-docs-that-stay-in-sync-with-code)) | Live — a convention (Nygard, 2011) | One dated decision, with context and consequences | Read in order; supersession links | **Never stale by construction** — append-only, dated | Write one per decision | Records decisions, not structure. Says nothing about how the system is shaped today |
| **[AGENTS.md](https://agents.md/)** ([§](#8-docs-that-stay-in-sync-with-code)) | Live — stewarded by the Agentic AI Foundation (Linux Foundation); claims **60k+ projects** | Free-text instructions for an agent | The agent reads it | Whatever humans commit | Write the file | Hand-authored; but proof that repos will carry a file for an agent that they won't carry for a human |
| **GitHub Wiki** ([§](#8-docs-that-stay-in-sync-with-code)) | Live | A wiki page | Page links | **None** — a separate git repo nobody edits | Zero | Rots by default; the canonical baseline everything here claims to beat |
| **[CodeCity](https://wettel.github.io/codecity.html)** ([§](#9-spatial-visualisation-and-the-academic-record)) | Research prototype, dormant — thesis 2010, experiment ICSE 2011; VISSOFT 2020 Most Influential Paper | Class = building, package = district, methods = height, LOC = colour | Fly the city; select a building | Re-import the model | Moose/Smalltalk model import | Won on *overview* (+24% correctness) but **lost every precision task**; one task deleted from the analysis. **Never independently replicated** |
| **[BabiaXR / VR city](https://doi.org/10.1007/s10664-023-10435-3)** ([§](#9-spatial-visualisation-and-the-academic-record)) | Research — EMSE 2024, pre-registered | Same metaphor, in VR | Walk the city | Re-import | VR headset | **Null result**: *"correctness of answers in both environments is comparable"* vs 2D dashboards (N=32) |
| **[ExplorViz](https://github.com/ExplorViz)** ([§](#9-spatial-visualisation-and-the-academic-record)) | Alive — pushed 2026-08-11, 15+ years of development | Live-trace software city | Fly; drill into a trace | Live traces | Instrument the app + run the stack | **Six stars.** The single most damning adoption datum in the survey |
| **[Gource](https://github.com/acaudwell/Gource)** ([§](#9-spatial-visualisation-and-the-academic-record)) | Alive — 13.1k stars, pushed 2026-03-06 | Animated repo history: files as nodes, committers as avatars | You watch it | Re-run over the log | `gource` on a git repo | Beautiful and non-interactive. Conference videos, not daily work |
| **[CodeCharta](https://github.com/MaibornWolff/codecharta)** ([§](#9-spatial-visualisation-and-the-academic-record)) | Alive, actively developed — v1.143.0, pushed 2026-08-09 | Code city with configurable metric → height/colour | Click a building; filter metrics | Re-run the importer in CI | Importers per analysis tool | The best counter-example to the demoware charge — and **491 stars after ~10 years** |
| **[Emerge](https://github.com/glato/emerge)** ([§](#9-spatial-visualisation-and-the-academic-record)) | Alive — 1.1k stars, pushed 2026-08-07 | File/entity dependency graph | Interactive web graph | Re-run the scan | Config + CLI run | Scan-and-look; no persistence, no narrative |
| **[SoftVis3D](https://github.com/stefanrinderle/softvis3d)** ([§](#9-spatial-visualisation-and-the-academic-record)) | **Archived** — last push 2023-09-18, 64 stars | Code city inside SonarQube | Click a building | SonarQube analysis | A SonarQube instance + plugin | Died quietly; the plugin route did not save it |
| **[repo-visualizer](https://github.com/githubocto/repo-visualizer)** ([§](#9-spatial-visualisation-and-the-academic-record)) | **Archived 6 Aug 2026** — 1.3k stars | Circle-packed file tree as an SVG in your README | None — it's a picture | GitHub Action on push | Add the action | README self-describes as *"an experiment"*. Decorative; no drill-in at all |
| **Sillito's 44 questions** ([§](#9-spatial-visualisation-and-the-academic-record)) | Research, FSE 2006 / TSE 2008 — the taxonomy, not a tool | Four categories by how much of the code graph an answer needs | — | — | — | Their verdict on tools like these: results shown *"as largely undifferentiated and unconnected lists with **no support for building towards an answer**"* |

---

## 1. LLM-generated repo wikis

### DeepWiki

Cognition's, the free public face of Devin Wiki and Devin Search. Launched 5 May 2025 with "over 50,000 of the top public GitHub repos" already indexed
([cognition.com/blog/deepwiki](https://cognition.com/blog/deepwiki)); the free public face of the
commercial Devin Wiki and Devin Search.

- **Unit** — a numbered wiki page per concept or subsystem (`deepwiki.com/LibreOffice/core/2-build-system`),
  each carrying prose, architecture diagrams and inline source citations. Second unit: the
  **persisted question-answer** at its own URL, so an answer is a shareable artefact rather than
  ephemeral chat.
- **Drill-in** — sidebar page tree; citation links from prose to exact file and lines on GitHub;
  a "Deep Research" follow-up box at the foot of every page. A maintainer's read
  **[community]**: *"where it truly shines is the 'deep research' follow-up questions system at
  the bottom"* ([HN 45002092](https://news.ycombinator.com/item?id=45002092)).
- **Freshness — the sharpest finding in the survey.** Public wikis do not refresh by default.
  From Cognition's own repo: *"We auto-refresh DeepWikis if their repo has a badge."*
  ([CognitionAI/deepwiki](https://github.com/CognitionAI/deepwiki)). The refresh trigger is a
  marketing link in your README. Private repos via Devin are indexed **manually** — Settings →
  Repositories → "Index repo" ([docs.devin.ai/onboard-devin/index-repo](https://docs.devin.ai/onboard-devin/index-repo)),
  with a bulk-index API for scripting it.
- **Setup** — public: **zero**, swap `github.com` for `deepwiki.com`. This is the single largest
  adoption lever anyone in this survey found. Optional `.devin/wiki.json` steers page set and
  supplies repo notes ([docs.devin.ai/work-with-devin/deepwiki](https://docs.devin.ai/work-with-devin/deepwiki)).
- **Why people push back** — several converging accounts, all **[community]**, all on
  [HN 45002092](https://news.ycombinator.com/item?id=45002092):
  - *Confident fabrication.* A LibreOffice contributor: *"We didn't ask for deceptive garbage to
    be generated as documentation for LibreOffice … (spoiler: LibreOffice has never used Buck as
    a build system)."*
  - *Size mistaken for importance* — the most diagnostic complaint in the whole survey. On LLVM:
    GlobalISel, InstCombine and TableGen simply absent, with the hypothesis that *"Clang codegen
    is ~100kloc and InstCombine is ~40kloc but since they're in several 4-5kloc files instead of
    a large 26kloc file (SLPVectorizer) or 62kloc file (X86ISelLowering), they're simply not
    considered important and ignored."*
  - *Staleness reads as hallucination.* A maintainer who nonetheless recommends it: *"I've caught
    DeepWiki hallucinating pretty convincingly far more than once just because a struct / a
    package / a function was named for something it wasn't doing anymore."*
  - *Externality.* *"I recently received an AI-slop bug report for a small open source project
    … and the slop was generated by DeepWiki … I wasted about an hour."* And: users find the
    generated wiki via Google and assume it is official. **No documented opt-out or takedown
    route exists** on deepwiki.com, docs.devin.ai or the repo README. The fullest maintainer
    postmortem is Bo Lopker's ([blopker.com/writing/12-deepwiki](https://blopker.com/writing/12-deepwiki/)):
    *"DeepWiki has broken my control over the communication channels I have set up with users."*
  - Cognition's own answer, from a founder **[community]**: *"you can never exclude hallucinations
    entirely … The reason we display the code snippets is to make it easy to double check with
    the source."* It also confirmed DeepWiki reads **only the codebase** — no issues, no PR
    history, no external docs.
- **DeepWiki MCP** — free, no auth, public repos only; `read_wiki_structure`,
  `read_wiki_contents`, `ask_question` at `https://mcp.deepwiki.com/mcp`
  ([cognition.com/blog/deepwiki-mcp-server](https://cognition.com/blog/deepwiki-mcp-server)).

### Windsurf Codemaps

Cognition, Nov 2025 — the interesting divergence.
[cognition.com/blog/codemaps](https://cognition.com/blog/codemaps), explicitly *"building on
earlier Cognition work like DeepWiki."* The unit is a **task-scoped map**, not a repo-scoped
wiki: state what you are trying to do, get a node graph with exact line numbers, each node
clicking through to the editor, referenceable in the agent as `@{codemap}`. **Per-task and
disposable — it sidesteps staleness by refusing to be a persistent artefact.** That is the
opposite bet from the Atlas, and the honest counter-argument worth answering in #646.

### Google Code Wiki

Nov 2025. [developers.googleblog.com](https://developers.googleblog.com/introducing-code-wiki-accelerating-your-code-understanding/),
product at [codewiki.google](https://codewiki.google/). Wiki page per module plus diagrams plus
a repo-scoped Gemini chat with citations. Public repos only; private repos were to arrive via a
Gemini CLI extension that is now stranded — Gemini CLI is being retired into Antigravity with
Free/Pro/Ultra requests ending 18 Jun 2026. Freshness, official wording only: *"Code Wiki scans
the full codebase and regenerates the documentation after each change."*

Two things matter here. First, provenance **[community]**: on
[HN 45926350](https://news.ycombinator.com/item?id=45926350) the founder of Mutable.ai states
Code Wiki is a rebuild of Mutable's Auto Wiki by the same team after Google acquired them.
Second — and this is a direct design constraint on the Atlas — **the loudest complaint was about
regeneration itself**: *"If I could be in the middle of reading it, and the next day it's
completely different, that's a huge waste of my time."* Continuous regeneration destroys the
stable referent that makes a document citable. Also **[community]**: *"a wall of text, no visual
appeal"*, and *"you have a pattern of using the word 'wiki' to describe products that have
nothing to do with wikis"* — nobody can edit it.

### Mutable.ai Auto Wiki

The ancestor of both DeepWiki and Code Wiki, and the richest source in this survey.
[HN 38915999](https://news.ycombinator.com/item?id=38915999) (183 pts, Jan 2024). Unit: a
Wikipedia-style article per module with Mermaid diagrams. Its genuinely transferable idea was
v2's chat, which did **RAG over the generated wiki rather than over code chunks** —
[HN 40998497](https://news.ycombinator.com/item?id=40998497). Both `mutable.ai` and
`www.mutable.ai` now fail DNS resolution; no shutdown notice exists.

The objections were structural, not bugs, and every one of them recurred verbatim in the
DeepWiki thread nineteen months later **[community]**:

- *"And its wrong! Its not difficult to find whole paragraphs that were entirely made up."*
- The externality, **predicted before DeepWiki existed**: *"Person reads your auto wiki
  explanation … The explanation is incorrect … The maintainers now have to deal with this
  misinformation."*
- **The load-bearing one:** *"Good documentation doesn't explain what the code does, it explains
  why the code is written the way it is … You can't really guess those things by looking at
  code."*
- Verification cost exceeds writing cost: *"Would I get a little refund for each mistake I find
  and have to correct?"*

### deepwiki-open and OSS clones

[AsyncFuncAI/deepwiki-open](https://github.com/AsyncFuncAI/deepwiki-open) — MIT, ~17.6k stars,
active. Same unit, plus a newer "codemap" feature. **Freshness is broken by design and users say
so:** issue [#371](https://github.com/AsyncFuncAI/deepwiki-open/issues/371) — *"regenerating the
wiki actually lets the AI generate a new wiki using the existing code and vector data … Should it
be optimized to check and pull the latest code, update the vector library, and then generate a
new wiki?"* Issue [#402](https://github.com/AsyncFuncAI/deepwiki-open/issues/402) reports the
hosted DeepWiki not picking up new commits. The rest of the issue tracker is cost and rate
limits. [AIDotNet/OpenDeepWiki](https://github.com/AIDotNet/OpenDeepWiki) is the smaller C#
equivalent. Worth noting as an alternative shape: `yamadashy/repomix` packs a whole repo into one
LLM-ingestible file — no wiki, no index, no staleness.

---

## LLM-era IDE and vendor features

These mostly do not produce an artefact a person reads. They matter here for their **freshness
mechanisms**, which are the best-documented in the survey, and for two deliberate negative
results.

**Two indexing camps, and the line moved.** Prebuilt embeddings: Cursor, Windsurf/Devin, GitHub's
server-side index. On-demand agentic search: **Zed removed its semantic index in v0.128.3 (March
2024)** — *"We are temporarily removing the semantic index in order to redesign it from scratch"*
([release notes](https://github.com/zed-industries/zed/releases/tag/v0.128.3)) — and never
restored it; there is no `semantic_index` crate in `main` today. Zed's current stance is explicit:
*"I didn't have to teach the agent anything about my code base first, or wait for an indexing
process to finish"* ([zed.dev](https://zed.dev/blog/fastest-ai-code-editor)). More significantly,
**GitHub's own Copilot code review moved to an agentic tool-calling architecture on 5 Mar 2026**
([changelog](https://github.blog/changelog/2026-03-05-copilot-code-review-now-runs-on-an-agentic-architecture/)),
gathering code, directory structure and references on demand — GitHub choosing *not* to consume a
prebuilt semantic index for its highest-volume comprehension task. No index, no staleness.

Cursor is the only vendor defending embeddings with a number: **+12.5% average accuracy** on its
own "Cursor Context Bench" ([cursor.com/blog/semsearch](https://cursor.com/blog/semsearch)) —
vendor benchmark, unaudited. Its freshness design is the best of the index camp: a **Merkle tree
of SHA-256 file hashes**, syncing only the branches whose hashes differ, with embeddings cached by
chunk hash ([secure codebase indexing](https://cursor.com/blog/secure-codebase-indexing)).

**Every index-based product shares three failure modes**, visible in their own issue trackers:
builds that stick or never complete
([vscode#256998](https://github.com/microsoft/vscode/issues/256998),
[Cursor forum](https://forum.cursor.com/t/codebase-indexing-stuck/60586)); **silent staleness after
renames and moves**, with the assistant citing the old structure
([Cursor forum](https://forum.cursor.com/t/codebase-indexing-not-updating-after-file-changes/144970));
and a size cliff — VS Code's own error string reads *"indexing currently is limited to 2500 files.
Found 20424 potential files to index"*
([vscode-copilot-release#4936](https://github.com/microsoft/vscode-copilot-release/issues/4936)),
Windsurf recommends no more than ~10,000
([docs](https://docs.devin.ai/desktop/context-awareness/windsurf-ignore)).

**The freshness ladder, ranked by documented mechanism** — this is the most directly reusable
output of this whole survey for [#649](https://github.com/milad-alizadeh/argo/issues/649):

1. IDE-inherited continuous index (JetBrains Junie — free, because the IDE was indexing anyway)
2. Real-time file watch (Augment local)
3. File-save hooks (Kiro) / push-to-default-branch (Augment remote)
4. Conversation start, *"within seconds"* (GitHub server-side index)
5. Merkle-diff polling (Cursor)
6. **Detected divergence between code and docs** (Komment)
7. Commit-scoped partial regeneration of only affected nodes (Driver.ai)
8. Session start with a 14-day index expiry (JetBrains Context)
9. "After each change", mechanism undocumented (Google Code Wiki)
10. **Badge-gated auto-refresh** (DeepWiki public)
11. Every N days (Windsurf remote, Enterprise)
12. Manual re-run (Amazon Q `/doc`, Devin private index)
13. Never — regenerates from a stale vector cache (deepwiki-open)

Rungs 6 and 7 are the interesting ones for a persisted atlas, because they are the only two that
refresh *part* of the artefact in response to *evidence that it is wrong*, rather than on a clock
or on every commit. Rung 1 is the cheapest and Argo has an analogue of it: Argo is already
watching.

Two more worth noting for content rather than freshness. **Copilot Spaces** (GA 24 Sep 2025) is the
only unit here that is human-curated, shareable and permission-aware, with a design detail worth
stealing: **whole repos are retrieved from, individually attached files are loaded in full on every
query** — so attaching a file is the "pin this" gesture. Its launch complaints
([community discussion](https://github.com/orgs/community/discussions/160840)) were about caps and
reach, **never the concept**. And **Augment's Context Lineage** indexes git history itself, with
each diff summarized by a small model and embedded alongside the code chunks, so an agent can ask
*why* something changed ([blog](https://www.augmentcode.com/blog/announcing-context-lineage)) —
the nearest anyone gets to the "why" gap without leaving the repo.

### The onboarding-startup cohort

Nine startups sold "understand your codebase" between 2023 and 2026. **Not one of them still sells
it as its primary product.**

- **Bloop** is the most instructive corpse. Launched as semantic code search (264-point Launch HN,
  Apache-2.0, 9.5k stars); repo archived 2 Jan 2025; pivoted to COBOL modernization, then to Vibe
  Kanban; company shut down 10 Apr 2026 ([HN 47718190](https://news.ycombinator.com/item?id=47718190)).
  Three converging launch-thread objections **[community]**: search wasn't better than grep
  (*"ML-based search methods for code are just not that useful. They do sound nice for
  non-coders"*), hallucination unaddressed, and no moat.
- **Onboard AI → Greptile.** The rename is undocumented by the company; `getonboardai.com` now
  fails with an expired certificate. Greptile launched as *"RAG on codebases that actually works"*
  ([HN 39604961](https://news.ycombinator.com/item?id=39604961), 253 pts) and today sells PR
  review. **The proof of the pivot is negative and primary**: the full docs index at
  [greptile.com/docs/llms.txt](https://www.greptile.com/docs/llms.txt) lists Code Review,
  Cross-Repo Context, MCP, Deployment, Billing — and no query, search or chat endpoint anywhere.
  On freshness, the founder said in the launch thread: *"Haven't figured out what should trigger
  updates."*
- **Ellipsis** pivoted review → agent cloud. **Komment** and **Driver.ai** are alive with
  essentially no public footprint (one HN post at 2 points; zero HN stories respectively).
  **Unblocked** is the one that widened rather than narrowed, and is covered in
  [§8](#8-docs-that-stay-in-sync-with-code). **CodeSee** and **Cody** are covered in
  [§2](#2-codesee) and [§3](#3-sourcegraph).

The pattern is stated plainly in failure mode 10 below: every survivor attached comprehension to
an event that already existed in the workflow — a PR, an agent tool call, a file save. Every
casualty asked a human to go somewhere and ask a question.

---

## 2. CodeSee

The code-map generation, and what happened to it. Four surfaces, per the final archived site
([2024-03-09 snapshot](https://web.archive.org/web/20240309043453/https://www.codesee.io/)):
**Codebase Maps** (*"an interactive, editable architecture diagram … The arrows between files or
folders indicate dependencies"*), **Review Maps** auto-posted on every PR, **Service Maps** built
from OpenTelemetry or Datadog traces rather than static analysis, and **Code Tours** plus, from
late 2023, Function Maps and CodeSee AI.

- **Unit** — the file/folder node and the import edge. Human knowledge attached as labels, notes
  and tours layered *on top of* a generated graph. Overlays for hot spots, latest activity, LoC.
- **Drill-in** — expand/collapse folders on canvas, click a node for its code and metadata, hide/
  show to carve a view, follow a Tour.
- **Freshness — the one axis CodeSee genuinely solved.** A GitHub Action on push-to-main and
  `pull_request_target`; analysis ran on GitHub's runners and uploaded metadata, not source
  ([installation doc](https://web.archive.org/web/20220528062835/https://docs.codesee.io/docs/installation)).
  Manual layout and annotations were the part that still rotted.
- **Setup** — *"Most teams are fully set up in 3 mins or less"*: GitHub App auth, workflow file,
  repo secret. Languages, from the action's own `lang-setup` input
  ([Codesee-io/codesee-action](https://github.com/Codesee-io/codesee-action)): node, python, jdk,
  .net, rust, plus a static Go binary — with C# and PHP still "preliminary" in the last changelog
  before shutdown. It began as a JS/TS tool (the 2021 docs are all `setup-cra`, `setup-next`,
  `setup-gatsby`) and grew outward.
- **Why it died — the founder's own account.** Shut down 22 Feb 2024; homepage banner: *"Sad
  news! CodeSee shut down on Thursday, Feb 22nd."* Shanea Leven's announcement gives the reasons:
  2023 doubled new logos and grew free users but **sales growth was inconsistent**; deep code
  understanding needed *"more complex codebases, more IDEs, more tech stacks, and more programming
  languages"* they could not fund; **GenAI made the space more complex**, both a tool and a source
  of ever more code; and they **received a term sheet and judged it insufficient**
  ([LinkedIn](https://www.linkedin.com/posts/shaneak_i-am-very-sad-to-announce-officially-activity-7163970333912289281-DaOb)).
  GitKraken acquired the assets 14 May 2024
  ([gitkraken.com](https://www.gitkraken.com/blog/gitkraken-launches-devex-platform-acquires-codesee));
  `codesee.io` now returns 404, the map actions are archived, and thousands of repos still run a
  `codesee.yml` against a dead endpoint.
- **The honest signal is the absence of a community.** No HN thread about CodeSee ever cleared 12
  points in four years — launch 2 points/0 comments, acquisition 12 points/0 comments, the
  shutdown never submitted. There is **no primary community postmortem**; the "maps went stale /
  only useful in week one / pretty but unused" critique circulates in secondary comparison
  content with no sourced origin, and should not be cited as evidence. The nearest structural
  critique from that era is from a peer founder on the Sourcetrail thread and applies verbatim
  **[community]**: *"call graph visualizers are the sort of thing that you would need only once or
  only every once in a while … it's hard to justify a subscription"*
  ([HN 28638978](https://news.ycombinator.com/item?id=28638978)).

---

## 3. Sourcegraph

Search, notebooks, Cody. Sourcegraph matters here less as a comprehension tool than as the company that **tried the
comprehension product explicitly, shipped it, and removed it.**

- **Code search / navigation.** Unit: a file+line match; a symbol occurrence; a repo tree. There
  is no unit above the symbol — no subsystem, no concept, no "how this works". A fallback ladder
  runs precise → syntactic → search-based
  ([docs](https://sourcegraph.com/docs/code-search/code-navigation)). **Precise** navigation is
  the only genuinely semantic rung and it needs a per-language SCIP indexer, CI wiring or
  executors, and a build that compiles in a sandbox. **Search-based** — *"a mix of text search and
  syntax-level heuristics (no language-level semantic information)"* — needs nothing, and is what
  almost everyone got. The tell is that Sourcegraph later built a **syntactic** middle rung
  described as *"a zero configuration feature"*; you do not build a middle rung unless the top
  rung went unclimbed.
- **Notebooks — the onboarding attempt.** GA in 3.39, April 2022: markdown interleaved with live
  search, file and symbol blocks, authorable in the web UI or as a `.snb.md` in the repo. The
  pitch is exactly the docs-don't-rot claim: *"Documentation can easily go stale and lag behind
  the code it documents, especially for internal tools and libraries where APIs can change
  liberally"* ([sourcegraph.com/blog/notebooks-ci](https://sourcegraph.com/blog/notebooks-ci)).
  Instead of pasting a snippet that rots, you paste a query that re-executes.

  It died in four visible stages: the notepad capture UI removed in 5.3.0, Jan 2024
  ([PR #58217](https://github.com/sourcegraph/sourcegraph-public-snapshot/pull/58217)); the public
  gallery unlinked Dec 2024; **the feature removed in 7.0, Feb 2026**; the docs deleted March
  2026. The stated replacement is the load-bearing sentence:

  > "**Search Notebooks** … Deep Search conversations collect findings and citations in a central
  > place. We believe that the future lies much more in this type of agent-driven code
  > exploration."
  > — [7.0 removals and deprecations](https://sourcegraph.com/changelog/7-0-removals-deprecations)

  Read directly: Sourcegraph concluded that a hand-curated living document is the wrong artefact
  and a generated answer-with-citations is the right one. Reading the evidence rather than the
  announcement, authoring was manual — the same cost that makes documentation rot in the first
  place — the freshness guarantee covered only the query results and never the prose around them,
  and discovery was poor because notebooks lived on a separate surface from where you read code.
- **The surviving pattern.** Code Insights (a query plotted over time) and Batch Changes both
  survived and were rebuilt around agents. What was removed in 7.0 alongside Notebooks was
  Sourcegraph Own / CODEOWNERS, with the reason *"With agents in the mix, ownership is blurrier
  than ever."* **The derived-from-query surfaces lived; the hand-curated surfaces were cut.**
- **Cody, and a real negative result for RAG-over-code.** Cody launched on embeddings and then
  **removed them**, replacing vectors with BM25-adapted search
  ([How Cody understands your codebase](https://sourcegraph.com/blog/how-cody-understands-your-codebase),
  Feb 2024; [PR #59493](https://github.com/sourcegraph/sourcegraph-public-snapshot/pull/59493)).
  Three stated reasons: code had to ship to a third-party embedding API, embeddings were an admin
  burden, and vector DBs did not scale past 100,000 repos. The company with the best code index in
  the industry measured embeddings against BM25 and chose BM25. Drill-in was `@`-mentions of file,
  symbol or repository, with a sharp edge: *"any chat without a context chip will instruct Cody to
  use no codebase context."* Cody Free/Pro/Enterprise-Starter were discontinued 23 July 2025
  ([blog](https://sourcegraph.com/blog/changes-to-cody-free-pro-and-enterprise-starter-plans));
  Amp spun out as an independent company 2 Dec 2025.
- **The business arc, because it explains the abandonment.** Open-sourced Oct 2018; free
  self-hosted tier gutted Feb 2023 (private repos cut from unlimited to one, SSO removed);
  **relicensed to enterprise 13 June 2023** ([PR #53345](https://github.com/sourcegraph/sourcegraph-public-snapshot/pull/53345),
  body: *"Preparing for 5.1 based on latest executive decisions"*), with the reasons given not in
  a blog post but in a **GitHub issue comment**
  ([#53528](https://github.com/sourcegraph/sourcegraph-public-snapshot/issues/53528#issuecomment-1594967818)):
  *"Very few individual devs or companies used the limited variant of code search that was open
  source … The source code will remain publicly available."* That promise broke in Aug 2024 when
  the repo went private, leaving only an archived
  [public snapshot](https://github.com/sourcegraph/sourcegraph-public-snapshot).
- **Why it never became the onboarding tool** — the stated community reasons **[community]**,
  from [HN 36584656](https://news.ycombinator.com/item?id=36584656) and
  [HN 41296481](https://news.ycombinator.com/item?id=41296481): a $2,450/mo price floor with no
  path for a small team; an OSS build that was *deliberately* unusable (*"the OSS build was
  broken"*, an unofficial community Docker image with 10k+ pulls) which contradicts the "99.9%
  used enterprise" justification; and one damning adoption datapoint — a company that synced 750
  repos and found **3 of 70 registered users** used it meaningfully. Ex-employee Eric Fritz's
  [Sourcegraph went dark](https://eric-fritz.com/articles/sourcegraph-went-dark/) is the best
  first-hand account.

  The structural read: **every Sourcegraph unit is derived from a query, and a query only answers
  a question you already knew to ask.** Fine for "where is this used", useless for "what is this
  system". Notebooks bridged that by having a human pre-write the questions, which reintroduced
  the authoring cost.

---

## 4. Sourcetrail

Archived, and why. Desktop, offline, Qt. *"static analysis on C, C++, Java and Python source code … navigate the
collected information within a user interface that interactively combines graph visualization and
code display."* 16.5k stars, GPL-3.0, archived, last release Nov 2021.

- **Unit** — the **symbol** and typed relations between symbols (call, inheritance, include,
  usage) in a SQLite index. Not files. Two human-overlay units: **bookmarks**, and — the closest
  thing in this whole survey to a saved reasoning path — the **Custom Trail** (`Ctrl+U`), a
  filtered graph answering "how does A reach B", persisted.
- **Drill-in** — search a symbol, graph centres on it and its neighbours, click a neighbour to
  re-centre; a toolbar switches trail type (call graph, inheritance chain, include tree); the code
  pane scrolls in lockstep ([DOCUMENTATION.md](https://github.com/CoatiSoftware/Sourcetrail/blob/master/DOCUMENTATION.md)).
- **Freshness** — manual, local, incremental. `F5` reindexes changed files and their dependents,
  `Shift+F5` everything. No CI, no server, no shareable committed index — a 2017 request for
  exactly that never shipped.
- **Setup** — the highest cost of the three desktop tools. C/C++ wants a clang
  `compile_commands.json`; Java imports from Gradle or Maven; Python is directory-based.
- **Why archived — the primary text.** *"Discontinue Sourcetrail"*, Eberhard Gräther, 23 Sep 2021
  ([archived](https://web.archive.org/web/20210924004042/https://www.sourcetrail.com/blog/discontinue_sourcetrail/)):
  after closing the company both founders took day jobs and stopped being co-located; *"it has
  always been an ambitious software with many tech dependencies, which require constant attention
  … this makes it rather hard to maintain and pick up again"*; and *"Eventually, we also lost
  interest … we learned about the real-world challenges of creating a developer tool and know that
  it entails a lot of work that is often frustrating and simply not fun."*

  The **commercial** failure is documented earlier and more usefully, in the 2019 open-sourcing
  post ([archived](https://web.archive.org/web/20190819014314/https://www.sourcetrail.com/blog/open_source/)),
  which names three failure modes exactly:
  1. *"Not every developer recognizes Sourcetrail's advantages"* — *"the majority of software
     developers doesn't see the advantages at first glance … a rather big disadvantage for a small
     company to sell a product where the supposed value is not immediately clear."*
  2. *"Not every developer agrees to Sourcetrail's commercial licensing"* — procurement friction;
     *"Over the years I saw developers that were happy with Sourcetrail fail in every single one
     of these steps."*
  3. *"Not every developer can use Sourcetrail on the desired codebase"* — 40% language coverage,
     scale limits above 10 MLoC, and the setup trap stated with the exact irony that matters here:
     *"Many companies also use self-made build systems, so developers have to resort to manual
     Sourcetrail project setup. This can cause quite a lot of frustration … **especially newcomers
     that would benefit the most**."*
- **Community diagnosis** **[community]**, [HN 28637193](https://news.ycombinator.com/item?id=28637193):
  the episodic-use problem (*"hard to justify a subscription"*); the incumbent problem
  (*"everyone who's willing to pay for a good IDE is already subscribed to JetBrains … There's no
  customer pain to alleviate"*); and the value-vs-friction exchange — *"Is Sourcetrail and a
  document for taking notes measurably better than having an IDE with 2 panes, 'go to definition'
  and 'find all references'? In my experience it's not really, and it was tricky to setup"*,
  answered by *"it's a matter of friction … In Sourcetrail you mouse over the symbol and click
  once. And it exposes the dependencies graphically."*
- **Forks are alive**: [petermost/Sourcetrail](https://github.com/petermost/Sourcetrail) (750
  stars, releases through 2025.12.8), [OpenSourceSourceTrail](https://github.com/OpenSourceSourceTrail/Sourcetrail),
  [quarkslab/NumbatUI](https://github.com/quarkslab/NumbatUI).

---

## 5. SciTools Understand

The one that survived, and what it cost. Alive and shipping: Understand 8.0, May 2026. It did not fail; it **retreated to a defensible
niche**, and the shape of that niche is the finding.

- **Unit** — the **entity** and the **reference**, in a `.und` cross-reference database. Plus a
  second unit nobody else has: **Architectures**, a human-authored abstract hierarchy grouping
  entities into logical components, against which dependencies and metrics are then reported
  ([scitools.com/features](https://scitools.com/features)). This is the only durable,
  human-authored, machine-checkable decomposition in the survey — and it is the one thing that
  outlives a browsing session.
- **Drill-in** — pick an entity, follow references bidirectionally, open any of a dozen graph
  types on it (call tree, butterfly, control flow, UML, dependency), browse dependencies between
  Architectures, script traversal via the Python API.
- **Freshness** — manual but automatable: "Re-analyze after code changes" (incremental) or
  "Analyze All Files"; watched directories catch adds and deletes; a first-class `und … analyze`
  CLI with **DevOps/CI license SKUs** so re-analysis can be a pipeline step.
- **Setup** — project plus per-language parser config; for C/C++ accuracy you import the real
  build (Visual Studio, `buildspy` on gcc, CMake, or `compile_commands.json`). There is a whole
  support-article genre titled "Building an *Accurate* Understand Project."
- **Why it never went general** — its buyer is compliance, not the developer.
  [Pricing](https://scitools.com/pricing) is subscription-only at *"$100–120 USD per month with a
  minimum term of 12 months"*, per developer. The value props are MISRA (~91%), AUTOSAR (~90%) and
  CERT coverage, offline secure-lab licensing, and Ada/Fortran/JOVIAL/VHDL parsers. Users are NASA,
  Air Force, Navy, Raytheon, Toyota. **[community]** on the 2017 Sourcetrail thread: *"My previous
  company used Understand on a large unfamiliar codebase, it helped greatly, but was pricey"*
  ([HN 14616316](https://news.ycombinator.com/item?id=14616316)). Its total HN footprint is one
  submission, 1 point. It is not in the conversation and does not need to be — which is exactly
  the escape route a Sourcetrail commenter named: dev tools monetise *"from the security/
  compliance/productivity angle (which doesn't really target developers though, more their
  superiors)."*

---

## 6. Dependency and architecture tools

**Structure101 — acquired and discontinued.** Sonar acquired it 15 Oct 2024; the products are
**no longer available for purchase** ([sonarsource.com/structure101](https://www.sonarsource.com/structure101/),
[press release](https://www.sonarsource.com/company/press-releases/sonar-acquires-structure101-to-strengthen-code-quality-offering/)).
Unit: a *containment model* built from **compiled artifacts** — function → class → package →
module → jar → architectural layer — plus a **virtual** hierarchy of groupings that don't exist in
the physical package structure. Its signature artefact, the **Levelized Structure Map**, laid items
into rows so that *"as far as possible every item depends on at least one item on the level
immediately below it"* — the layout itself encodes the dependency structure. Drill-in was
double-click to expand or collapse a level, anywhere from architecture down to functions.
Freshness came from an IDE plugin that checked architecture violations during the build and could
**fail compilation** on a violating dependency. Setup was the killer: point it at jars, then have
**a human author the target architecture** — an architect role many teams don't staff, and nothing
useful is enforced until that authoring happens. Compiled-artifact input locked it out of JS/TS,
Python and Go. The endgame is the tell: Sonar bought it to fold structural analysis into a tool
people already run, not to keep selling it.

**NDepend — alive, actively shipping, permanently niche.** Unit: a queryable **code model** over
compiled .NET assemblies, interrogated with **CQLinq**, C# LINQ over that model, ~200 default
queries ([ndepend.com/features/cqlinq](https://www.ndepend.com/features/cqlinq)). Its freshness
mechanism is the best-designed in this cluster: **Quality Gates are themselves CQLinq queries**,
and they can be **diff-against-baseline** — forbid more than 2 man-days of new debt since
baseline; surface new smells in Visual Studio before commit
([quality-gates](https://www.ndepend.com/features/quality-gates)). Analysis is rebuilt from
assemblies on every run; nothing is hand-maintained. Setup is genuinely light — attach an
`.ndproj` to a `.sln`. Why it stays niche: Windows plus Visual Studio plus compiled .NET only;
per-machine seats *plus a separately paid build-machine licence* to get the CI enforcement that is
the entire point; and CQLinq is a second language to learn — the thing enthusiasts love is exactly
the thing that gates adoption. Siblings CppDepend and JArchitect are alive and far more obscure.

**CAST Imaging — the most relevant enterprise precedent.** It does what "automatically generate a
whole-system map of a legacy application" actually means at scale: call and data-access graphs,
**transaction traces and data lineage**, explicit *and implicit* architecture, across a claimed
450+ languages, frameworks and databases ([castsoftware.com/products/imaging](https://www.castsoftware.com/products/imaging)).
Unit: the **object** — every code element, DB table, screen, and the typed links between them,
unified across technologies. Drill: portfolio → application → layer → **transaction** (an
end-to-end call path from entry point to data) → object. Freshness: periodic re-scan, not
continuous. Setup is the real cost — analyzers per technology, source delivery, configuration;
Gartner reviewers report *"the on-premise integration was challenging"* and a *"rather high price
point"* **[community/review-site]**. It never became a developer tool because it is sold to CIOs
and modernization programmes, and its output is a portfolio-governance artefact, not something in
the inner loop. Its 2025 move is the same one everyone made: a **CAST Imaging MCP server**, GA 20
Nov 2025, pitching the system map as agent context.

**Lattix** (DSM, alive, quiet), **Sonargraph** (alive, broader languages than Structure101 ever
had, with the important design choice that its architecture model is a **textual DSL in the
repo** rather than a drawing in a tool), and **Moose/Pharo** (a toolkit for building your own
analysis, which is why it stayed academic) round out the cluster. All three carry the same
authored-model tax.

**Code-as-test — the approach that actually won.** ArchUnit (Java, 3.8k stars), dependency-cruiser
(JS/TS, 7.1k), Deptrac (PHP), Madge (JS, 10.1k). The pattern: **stop drawing the architecture,
assert it as a test that runs in CI.** No model to author separately, no drift, because the rule
and the code live in the same repo and the rule fails the build. **These tools have no unit of
knowledge you browse and no drilling model at all.** You don't look at anything. That is precisely
why they out-adopted every drawing tool in this survey, and precisely their limit: they can only
tell you when a rule you already knew to write was broken. They cannot tell you what your system
looks like.

**C4 and Structurizr — Simon Brown's own admission.** The [C4 FAQ](https://c4model.com/diagrams/faq)
is candid and level-dependent: System Context diagrams *"will change very slowly"*; component
diagrams *"may change frequently"*; code diagrams *"will potentially become outdated very quickly
if the codebase is under active development."* His recommendation for components is **not to draw
them** — *"Static analysis / reverse-engineering of code as a source of data for identifying
components and their relationships."* He borrows George Fairbanks' **"model-code gap"** and
proposes closing it with an *architecturally-evident coding style* — annotations, naming
conventions, namespacing — that makes the architecture legible to a parser. He proposed this
around 2014, built Structurizr on it, and was **still** giving talks on reverse-engineering
architecture diagrams from Java at JFokus 2025. Meanwhile the Structurizr **cloud service reaches
EOL 30 Sep 2026**, with all workspaces read-only from 1 Jul 2026, and Brown's stated reason is
itself a finding worth carrying: *"engineering teams have consistently been reluctant to publish
their software architecture diagrams to the cloud"* ([docs.structurizr.com/eol](https://docs.structurizr.com/eol),
[Patreon post](https://www.patreon.com/posts/cloud-service-of-142577083)).

**arc42** — a free, respected, twelve-section documentation *template* with **no freshness
mechanism at all**; nothing derives it and nothing checks it. The existence of the one-page
"arc42 canvas" is the tacit admission that twelve sections are too heavy to maintain.

---

## 7. CodeScene

The closest thing to a working answer. CodeScene matters most in this survey because its **setup cost is zero and its map is generated,
not authored**. Everything is derived from **version-control history** joined to source analysis —
the temporal dimension static analysis discards.

- **Unit** — a **file with a history**. Rendered as a circle-packing map where *"each large blue
  circle represents a folder in the codebase"*, nested and zoomable
  ([hotspots doc](https://codescene.io/docs/guides/technical/hotspots.html)).
- **What it computes** — **Hotspots** (change frequency × low Code Health, weighted by how many
  modules change together and how many developers touch the code); **Code Health**, a weighted
  average over 25+ factors at module, function and implementation level; **change coupling**,
  files that change together over time whether or not they reference each other, with the
  architectural reading that the ones to hunt are those **crossing architectural boundaries**;
  and **knowledge maps** — primary author per module weighted by deep history so it survives
  rewrites, plus **knowledge loss** (code whose author left) and an off-boarding simulation.
- **Drill-in — the best-shaped path in the survey.** Circle-packing map at repo scope → click a
  circle → file or directory sidebar → **X-Ray**, where *"CodeScene climbs down the abstraction
  ladder and runs a Hotspot analysis on a method level"*, giving per-function hotspots,
  per-function change coupling, and defect statistics broken down to individual functions
  ([X-Ray doc](https://codescene.io/docs/guides/technical/xray.html)). Two things distinguish it:
  the map is **generated, not authored**, and the ranking is **behavioural**, so the top of the
  list is where the organisation actually spends its time rather than where a complexity metric
  happens to peak.
- **Freshness** — re-analysis per commit or CI run, plus a **Delta analysis** on pull requests
  that scores the change itself. Hosted or on-prem.
- **Setup — the key property.** Point it at a git repo. No annotations, no build, no compiled
  artifacts, no authored model. The behavioural analyses are language-agnostic by construction.
  This is the sharpest contrast with every other tool in sections 4–6, which need either a build
  pipeline or a human-authored architecture, usually both.
- **Research basis, with numbers.** *Code Red: The Business Impact of Code Quality* (Tornhill &
  Borg, TechDebt 2022, [arXiv 2203.04374](https://arxiv.org/abs/2203.04374)) — 39 proprietary
  production codebases, 30,737 files, joined to Jira: low-quality code contains **15× more
  defects**, resolving issues in it takes **124% more time**, and shows **9× longer maximum cycle
  times**. *Ghost Echoes Revealed* (Borg, Ezzouhri, Tornhill, ICSME 2024,
  [arXiv 2408.10754](https://arxiv.org/pdf/2408.10754)) benchmarked Code Health against SonarQube's
  Maintainability Rating, Microsoft's Maintainability Index and SOTA ML on 404 files with **human
  expert judgement as ground truth**: Code Health matched SOTA ML and outperformed the average
  human expert while supplying actionable smell detail, and the authors recommend re-evaluating
  prior technical-debt research that relied solely on SonarQube data. **Caveat: all of this is
  authored by CodeScene's own founder and principal researcher, benchmarking CodeScene's own
  metric.** Peer-reviewed at real venues with replication packages, which is far better practice
  than the norm — but not independent, and no third-party replication was found.
- **Why it isn't universal.** Pricing is €18–27 per **active author** per month
  ([codescene.com/pricing](https://codescene.com/pricing)) — cost scales with headcount exactly
  where an episodically-used tool is hardest to justify. PeerSpot puts it at **0.9% mindshare** in
  static analysis **[community]**; SonarQube's free tier is already installed. And the substantive
  critique, from a Capterra reviewer **[community]**: *"Yes, it might help detect subtle bugs, but
  as it relates to code quality … and providing insights that help drive real business decisions
  about staffing, knowledge management, and refactoring, it comes very far short."* A hotspot map
  tells you where the pain is; it does not authorise the refactor. Note also the
  metrics-as-weapon hazard, which CodeScene addressed with a **formal public commitment never to
  evaluate individuals**, only teams — a stance worth copying if Argo ever surfaces per-Person
  facts.

---

## 8. Docs that stay in sync with code

**Swimm.** A Swimm doc is markdown plus code snippets bound to real code by "smart tokens", smart
paths and snippet references, stored as `.swm` files committed in the repo. **Auto-sync** checks
those bindings against the latest code on **every git commit** via a GitHub App and, where the
change is mechanical, rewrites the doc; where it isn't, *"Swimm's verification check fails, and
users are updated that the documentation is likely out of date and needs review"*
([how Auto-sync works](https://swimm.io/blog/how-does-swimm-s-auto-sync-feature-work)). Its own
statement of the limit is the important part: *"Swimm's Auto-sync feature understands when
something cannot be Auto-synced — at which point we leave a task for someone on your team to
reselect the snippet"*, and *"if the code vanishes entirely, it took its secrets with it, because
we can't document a negative."* **That is the whole doc-sync problem in one sentence: auto-sync
catches mechanical drift and cannot catch semantic drift.** A snippet can re-anchor perfectly
while the prose around it becomes false.

Swimm has since **pivoted to mainframe modernization** — [swimm.io/enterprise](https://swimm.io/enterprise)
now leads with *"Use secure AI to rapidly modernize your mainframe"* and *"Understand any
mainframe so you can modernize it"*, with the general-purpose dev-docs product no longer the
headline. The dev-docs product's structural problem was never auto-sync; it was that **someone
still has to write the doc**, which is the cost teams don't pay.

**Mintlify** kept the docs-as-code shape and dropped the code-sync ambition: every docs site is a
git repo with bi-directional sync, and its 2026 investment is AI-readability — auto-generated
`llms.txt`, `llms-full.txt`, `skill.md`, and an MCP server per docs site. The unit is a docs page;
freshness is whatever the humans commit.

**Backstage** is the component-level system map, and its failure mode is the cleanest instance of
the authoring tax. Entity kinds are Component, System, API, Domain, Resource, Group, User; the
catalog is populated from `catalog-info.yaml` files, and the docs are explicit about who keeps
them true: *"Teams owning the components are responsible for maintaining the metadata about them,
and do so using their normal Git workflow"*
([backstage.io/docs/features/software-catalog](https://backstage.io/docs/features/software-catalog/)).
Hand-maintained YAML goes stale, and once trust erodes adoption collapses; **[community]**
write-ups report average adoption around 10% of engineers and 6–12 months to a usable instance
with at least one dedicated engineer
([port.io](https://www.port.io/blog/what-are-the-technical-disadvantages-of-backstage),
[roadie.io](https://roadie.io/blog/3-strategies-for-a-complete-software-catalog/)).

**Unblocked** ([getunblocked.com](https://getunblocked.com/), $20M Series A May 2025) is the one
that widened rather than narrowed, and it attacks the *"code can't tell you why"* objection
head-on: it indexes GitHub, Linear, Jira, Slack and team docs together, *"reconciles information
across sources, including sources that contradict each other"*, and every answer links the sources
consulted. Unit: a synthesized answer. Freshness: kept in sync as the team pushes. It is now
primarily consumed through an MCP server by Claude Code, Cursor and Copilot — i.e. its reader is
increasingly a model.

**Others, briefly.** *CodeStream* (New Relic) — in-IDE discussion tied to code lines — reaches
**EOL 5 Nov 2026**, and the stated reason is a signal about the whole category: *"AI and agentic
code creation are transforming how developers interact with observability data. In this AI era,
CodeStream no longer provides the impact it once did"*
([docs.newrelic.com/eol](https://docs.newrelic.com/eol/2026/05/eol-05-11-26-codestream/)).
*Doxygen/Sphinx/JSDoc/TypeDoc* document what the signature already says, not how the system works.
*ADRs* (Nygard) are never stale by construction because they are append-only and dated — a
property worth stealing for #649. *AGENTS.md*, now stewarded by the Agentic AI Foundation under
the Linux Foundation, claims **60k+ open-source projects** ([agents.md](https://agents.md/)) — the
de facto machine-readable repo-context convention, and evidence that repos will carry a file for
an agent's benefit that they would not carry for a human's. *Komment* ships the freshness design
worth stealing — re-documenting on detected **divergence between code and docs** rather than on
every commit — with essentially zero adoption (one HN post, 2 points). *Driver.ai* produces
**symbol-complete** docs (every symbol, not a sampled summary — a direct answer to the "grab bag"
complaint) and **commit-scoped partial updates**, consumed primarily as MCP; it has zero HN
footprint.

---

## 9. Spatial visualisation and the academic record

The research says three things no product page will. **The famous CodeCity result is real but
narrow, and CodeCity lost on precision tasks.** **It has never been independently replicated, and
the modern immersive re-runs return null results.** And **the questions developers find expensive
are rationale, causality and impact — none of which a structural map answers.**

### Code City — what the controlled experiment actually found

Wettel & Lanza's city metaphor (VISSOFT 2007, [PDF](https://wettel.github.io/download/Wettel07b-vissoft.pdf);
VISSOFT 2020 Most Influential Paper) maps **classes to buildings, packages to districts, method
count to height, attribute count to base size, LOC to colour**. The evidence everyone cites is
*Software Systems as Cities: A Controlled Experiment*, ICSE 2011
([PDF](https://wettel.github.io/download/Wettel11a-icse.pdf), [DOI](https://dl.acm.org/doi/10.1145/1985793.1985868)).

- **The numbers.** 41 subjects across 4 sites in 3 countries, on FindBugs (93 KLOC) and Azureus
  (454 KLOC). **+24.26% correctness** (F(1,37)=14.722, p=.001) and **−12.01% completion time**
  (p=.043) overall.
- **The baseline is the caveat.** Not "2D visualisation" — **Eclipse plus a pre-built Excel
  spreadsheet** already containing all the metrics. And evolution analysis, one of CodeCity's
  strongest features, was **excluded** because Eclipse could not match it fairly.
- **Where CodeCity lost, which is the part nobody quotes.** Task A4.2 (find classes with highest
  average LOC per method) was **thrown out of the analysis entirely**: the CodeCity group scored
  0.06 with 19 nulls out of 22, the control group 0.86 with 15 perfect scores out of 19, in half
  the time. On A4.1 *"a spreadsheet is faster at finding precise answers in large data sets."* The
  authors' own summary: *"at focused tasks … CodeCity did not perform better than the baseline."*
  It won on **overview** tasks — spread of a term across classes, change impact.
- **The authors' own honesty, worth quoting into #646:** *"We believe this is due to both the
  visualization as such, but the metaphor used by CodeCity, but **we can not measure the exact
  contribution of each factor.**"* They also flag the experimenter effect (an author designed the
  tasks and grading), and that they **invented their own task set** because Sillito's questions
  were judged "too low-level".
- **No independent replication exists**, fifteen years on. What exists instead is a
  **pre-registered null result**: Moreno-Lumbreras et al., *Software development metrics: to VR or
  not to VR*, EMSE 29:42, 2024 ([DOI](https://doi.org/10.1007/s10664-023-10435-3)) — N=32,
  within-subjects, VR vs 2D dashboards: *"the correctness of answers in both environments is
  comparable"*, VR is *"equally effective as traditional screen setups"*. Being a registered
  report, it cannot be a file-drawer artefact. Merino et al. (VISSOFT 2017) compared immersive 3D,
  a **3D-printed physical model** and a plain screen across 27 participants and found the screen
  *least difficult* to use.

### The demoware charge, quantified by the field's own review

Merino, Ghafari, Anslow & Nierstrasz, *A Systematic Literature Review of Software Visualization
Evaluation*, JSS 2018 ([PDF](http://scg.unibe.ch/archive/papers/Meri18a.pdf)) — 387 papers across
all 16 editions of SOFTVIS/VISSOFT, 181 analysed:

- **62% (113/181) lack a strong evaluation.**
- **46% (83/181) were "evaluated" by usage scenarios** — the authors describing how they envision
  the tool being used.
- **13% had no explicit evaluation at all.** Only 29% ran an experiment; only **7% ran a case
  study with professional developers on real projects**.
- Of the 53 experiments, **only 30% included experienced developers**; **median 13 participants**.

Their conjecture, stated in the paper: *"the low adoption of software visualization results from
their unproved effectiveness and lack of evaluations."*

And when you ask professionals directly — Sensalire, Ogao & Telea, SOFTVIS 2008
([PDF](https://webspace.science.uu.nl/~telea001/uploads/PAPERS/SoftVis08/paper2.pdf)), 15 tools,
16 professional developers of whom **only 2 had ever used a visualisation tool**:

- ***"Over half of the participants questioned the need for SoftVis tools, and mentioned their
  preference for the Eclipse IDE."*** New tools *"should show clear advantages as compared to
  existing 'plain' IDEs."*
- ***"2D visualizations were much better accepted by nearly all users."*** Of 15 tools exactly one
  was 3D.
- **IDE integration was decisive**; standalone tools *"present a new learning challenge"*.
- **Query precision ranked very highly** — the market had already converged on precise search
  rather than pictures.

The adoption datum that matters most is an observation, not a survey: Roehm, Tiarks, Koschke &
Maalej, *How do professional developers comprehend software?*, ICSE 2012 — of **28 professional
developers at 7 companies, none used a dedicated program-comprehension tool**; 21 of 28 trusted
source code more than documentation, and 17 of 28 preferred asking a colleague over consulting
documentation. (Counts read from the authors' own conference slides; the paper is paywalled.)

### Modern descendants — status verified 12 Aug 2026

Gource (13.1k stars, alive — conference videos, not daily work), CodeCharta (491 stars, actively
developed, consultancy-backed — the best counter-example to the demoware charge, and still 491
stars after ten years), Emerge (1.1k), SoftVis3D (**archived**),
[githubocto/repo-visualizer](https://github.com/githubocto/repo-visualizer) (**archived 6 Aug
2026**, self-describes as "an experiment"). The most damning datum: **ExplorViz** — fifteen years
of continuous academic development, live-trace software cities, VR support, pushed to today — has
**six stars**.

Recent work continues the pattern. Krause-Glau et al., VISSOFT 2024
([arXiv:2408.08141](https://arxiv.org/abs/2408.08141)) is a 2024 software-city paper with **no user
evaluation at all**, inviting others to evaluate it. And the most interesting 2026 result points
sideways: Ma et al., ASE 2026 ([arXiv:2606.14061](https://arxiv.org/abs/2606.14061)) gave
multimodal agents repository graphs and found **vision-only representations reduced accuracy and
increased tokens**, while a **hybrid text+vision** representation cut input tokens up to 26% at
equal-or-better accuracy, concentrated in fault localisation.

### What developers actually ask — the taxonomy that should shape a node

**Sillito, Murphy & De Volder, *Questions programmers ask during software evolution tasks*, FSE
2006** ([PDF](https://www.cs.ubc.ca/~murphy/papers/other/asking-answering-fse06.pdf)) — 44
questions in four categories, and the categories are **graph-theoretic**: how much of the code
graph you need to answer.

1. **Finding initial focus points** (5 questions) — *"which type represents this domain concept?"*,
   *"where is the text in this error message?"*, *"is there a precedent or exemplar for this?"*
2. **Building on those points** (15) — one entity and its direct neighbours: parts of this type,
   who implements this interface, where is this called, where are instances created.
3. **Understanding a subgraph** (13) — a connected group *together*: *"how is this feature or
   concern implemented?"*, *"how is control getting from here to here?"*, *"how are these types
   related?"*, *"what is the behavior these types provide together and how is it distributed over
   the types?"*
4. **Questions over groups of subgraphs** (11) — the hardest and least tool-supported: *"what is
   the difference between these similar parts of the code?"*, *"to move this feature into this
   code what else needs to be moved?"*, *"what will be the total impact of this change?"*

Two things follow. First, their conclusion is aimed exactly at map-shaped tools: *"Tool design has
often targeted the questions and activities of programmers too narrowly … Results were presented
by tools in isolation as largely undifferentiated and unconnected lists with **no support for
building towards an answer**."* Second, **category 4 is the only category evenly split between
newcomers and experienced developers (48/52)** — everything else skews to newcomers. Orientation
is a newcomer problem; impact is permanent. A surface that only answers categories 1–2 is a
week-one tool, which is failure mode 4.

### The expensive questions are rationale and causality, and they are written down nowhere

- **LaToza & Myers, *Hard-to-answer questions about code*, PLATEAU 2010** — 179 professional
  developers at Microsoft, 94 distinct questions in 21 categories. **Rationale ranks first (42
  developers)** and their headline is that it is *"both most frequently reported AND unaddressed by
  research"*. The four rationale questions: *Why was it done this way?* · *Why wasn't it done this
  other way?* · *Was this intentional, accidental, or a hack?* · *How did this ever work?*
- **LaToza, Venolia & DeLine, *Maintaining mental models*, ICSE 2006**
  ([PDF](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/p492-latoza.pdf)) —
  rated "serious problem for me": **understanding the rationale behind a piece of code, 66% — the
  top-rated problem overall**; being aware of changes elsewhere impacting my code 61%;
  understanding the impact of my changes elsewhere 55%. Design documents were described as
  ***"write-only media"*** — written to structure thinking and pass review, *"seldom read later and
  almost never kept up-to-date"*. *"Lots of design information is kept in peoples' heads."*
- **Ko, DeLine & Venolia, *Information needs in collocated software development teams*, ICSE 2007**
  — 17 developers, 334 information-seeking instances. Most-unsatisfied needs, by percent
  deferred/abandoned and max observed search time: *What code caused this program state?* **61%, up
  to 21 min**; *Why was the code implemented this way?* **44%, 21 min**; *In what situations does
  this failure occur?* **41%, 49 min**. **Coworkers were the most frequent information source**,
  serving 13 of the 21 needs.
- **LaToza & Myers, *Developers ask reachability questions*, ICSE 2010** — 460 professional
  developers report asking control-flow reachability questions **more than 9 times a day**; 82%
  rate at least one hard; answering takes tens of minutes. In their Wizard-of-Oz study Eclipse
  users succeeded **0%** of the time.

### The unit of work is tiny, scattered, and has no home

**Ko, Myers, Coblenz & Aung, TSE 2006**
([PDF](https://faculty.washington.edu/ajko/papers/Ko2006SeekRelateCollect.pdf)) — 10 developers,
70-minute sessions on an unfamiliar 508-line program:

- **35% of working time went to navigation mechanics** — recovering task context, iterating search
  results, returning from navigations.
- **88% (±11) of searches led to nothing** used later; failed searches cost ~25 minutes of
  inspecting irrelevant code.
- **The working set finding.** The relevant code was a **median of 33 lines — about 7% of the
  program** — but spread across **2–4 files**, and *"in none of these editors is it possible to
  show these exact lines together in a single view."* Developers returned to it **18 times**. It
  was held only implicitly — in tree expansion state, file tabs, scroll position — and lost on
  every task switch, costing 60 seconds to rebuild. **Only 2 of 10 used bookmarks, and both
  abandoned them.**

Time-budget framing: **Xia et al., TSE 2018** ([PDF](https://baolingfeng.github.io/papers/tsecomprehension.pdf))
tracked 79 developers over 3,244 working hours and found **~58% of time goes to program
comprehension — and only ~20% of that happens in the IDE**, with 27% in web browsers.

### The theory, in the two lines that matter for a node

- **Brooks (1983)** — comprehension is successive refinement of **hypotheses**, confirmed by
  **beacons** in the code, and the first hypothesis forms the moment the developer sees anything at
  all. So the top level must name **domains, not directories**, and every node must expose enough
  beacon-level evidence to kill a wrong guess without opening a file.
- **Pennington (1987)** — 80 professional programmers; error rates by information type: **detailed
  operations 15%, control flow 21%, data flow 28%, state 30%, function 34%**. Developers
  reconstruct control flow nearly for free and are **worst at data flow and purpose** — so the
  views worth building are the ones a call graph does not give.
- **Soloway & Ehrlich (1984)** — the strongest number in the literature. Plan-conforming programs
  were answered correctly **88%** of the time versus **31%** for discourse-violating versions, and
  **the expert advantage vanishes entirely on violating code** (advanced: 87% → 34%); 66% of errors
  were exactly the plan-like wrong answer. **Surfacing convention violations is the highest-value
  warning a map can raise**, because that is precisely where an expert's fast path silently returns
  the wrong answer.
- **von Mayrhauser & Vans (1995)** — comprehension switches opportunistically between top-down,
  program-model and situation-model reading *at any abstraction level*, so a reader must be able to
  **change altitude at any moment without losing place**. A map that fixes one level fights the
  documented process.
- **Littman et al. (1987)** — systematic readers who trace data flow build a *strong causal* model
  and **succeed** at modification; as-needed readers build a *weak static* model and **fail**,
  because they cannot detect interactions between components. **The failure mode is undetected
  interaction**, which is an argument for making the impact neighbourhood a first-class thing to
  look at.
- **Storey (IWPC 2005)** — her cognitive-support framework asks for both browsing directions with
  arbitrary switching, inquiry at multiple abstraction levels, **multiple simultaneously visible
  context-driven views**, and the tool acting as **external memory**, including a **persistent
  history of searches and sessions across restarts**. She is also careful about the adoption
  argument: *"A lack of adoption is not enough to indicate that a tool is not useful as there are
  many barriers to adoption."*

### The whiteboard study — the most directly relevant paper in the survey

Cherubini, Venolia, DeLine & Ko, *Let's Go to the Whiteboard: How and Why Software Developers Use
Drawings*, CHI 2007
([PDF](https://files.software-carpentry.org/training-course/2012/08/cherubini-venolia-whiteboard-2007.pdf))
— 9 interviews plus **427 survey responses** at Microsoft.

- **95% agreed "understanding existing code" is an important part of my job** — the top-rated of
  nine drawing scenarios. **In all scenarios, sketches predominated and reverse-engineering tools
  were used least.**
- Most drawings were transient: *"The value of the diagrams was secondary to that of the setting in
  which they were generated."*
- **The finding that should shape any generated map:** *"When diagrams were generated
  automatically, they seemed to be regarded as less interesting than diagrams that were produced
  manually … automatically-produced visualizations do not require developers to externalize their
  mental models nor do they allow for flexibility in the level of detail."*
- **And the deepest one:** *"Unlike sketching buildings or mechanical parts, code is an abstract
  entity with few spatial features … the representation of code does not follow any intrinsic
  spatial mapping."* Developers reported *"the level of abstraction differs with every conversation
  and even within a conversation."*
- Their own recommendation is, almost verbatim, the Atlas brief: **combine reverse-engineering with
  sketching**, render **multiple levels of detail within a single drawing**, and — quoted in full
  because it is the design brief the literature actually hands you —

  > *"A visualization that was spatially stable, yet up-to-date with the evolution of the code,
  > could help a developer stay oriented … If the visualization were shared among the development
  > team then ad-hoc meetings, design reviews, and especially onboarding could benefit from the
  > common ground that it would create."*

  **Spatial stability plus freshness plus variable altitude** — not a cityscape.

### Onboarding specifically

- **Steinmacher et al.** (IST 2015 SLR; category detail from the OSS 2014 precursor,
  [PDF](https://www.ime.usp.br/~gerosa/papers/Steinmacher2014_Chapter_BarriersFacedByNewcomersToOpen.pdf))
  — five barrier categories. The two a repo map can actually remove are **understanding project
  structure/architecture** and **finding the correct artifacts to fix an issue**. Category 5 is the
  warning: *"a rich documentation is essential … but just providing a bunch of documentation leads
  to **information overload**."*
- **Dagenais et al., *Moving into a new software project landscape*, ICSE 2010**
  ([PDF](https://infobart.com/static/documents/icse2010.pdf)) — grounded theory over 18 newcomers
  joining 18 ongoing IBM projects. Four orientation aids recurred — previous experience, examples,
  **a mentor**, and colleagues — and the transfer mechanism was the **walkthrough**. Their
  conclusion: **no tool or map replaces the richness of a human guide; exploration tools should
  complement, not replace, human guides.** Low-level design and runtime behaviour were the
  least-documented and most-needed knowledge. This is the strongest empirical support in the survey
  for a *narrated tour* rather than a browsable diagram — and therefore for the voice direction in
  #643.
- **Begel & Simon, ICER 2008**
  ([PDF](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/icer-begel-2008.pdf))
  — 8 Microsoft new hires observed for 6–11 hours each. Communication was the largest task
  category, and the diagnostic anecdote is a subject burning 45 + 12 + 25 minutes on a bug whose
  root cause was **a wrong mental model of which libraries and directories the code belonged in**,
  resolved only when a colleague walked over and told him. **Newcomer time is lost to workspace and
  build topology facts nobody wrote down**, not to algorithmic difficulty.

### LLM-era comprehension research

- **Hallucination in code summarisation is not a tail risk.** *Hallucinations in LLM-Based Code
  Summarization*, PACMSE 2026 ([DOI](https://doi.org/10.1145/3808139)) — the Hallu-Eval benchmark
  drives Qwen2.5-Coder-7B from **17% to 97%** hallucination on perturbed code; the best mitigation
  moves DeepSeek-Coder-6.7B only **66% → 59%**. Two-thirds of summaries hallucinating on the harder
  set is the base rate an atlas has to design around. (Figures from the indexed abstract; ACM DL
  returned 403.)
- **Trust is mis-calibrated, and LLM-as-judge fails at this task.** Balfroid et al., 2026
  ([arXiv:2607.26987](https://arxiv.org/abs/2607.26987)) — 26 developers, 26 generated code tours
  from real Java bugs. Developers valued tours that **scaled detail with code length, avoided
  restating the code, were scannable, and adopted a guiding tone**. Two findings to design around:
  **developers trusted descriptions they perceived as human-written more than those they believed
  AI-generated**, and **LLM annotations of tour quality were unreliable — "sycophancy,
  confabulation, and incoherence were pervasive."** The second kills the obvious shortcut of having
  a model grade its own atlas.
- **The one positive result for a hierarchical map.** Gao et al., *CodeMap*, ICPC 2026
  ([arXiv:2504.04553](https://arxiv.org/abs/2504.04553)) — hierarchical codebase visualisation
  aligned to "human cognitive flow", designed from interviews with 8 code-auditing professionals.
  User study, 15 developers: significantly improved perceived intuitiveness and usefulness,
  **reduced reliance on interpreting LLM responses by 79%**, and **increased map usage time by 90%
  versus static visualization tools**.

---

## 10. The recurring failure modes

Stated plainly, in the order they kill things.

1. **The authoring tax.** Every artefact that says what a system *means* was hand-written, and
   hand-written artefacts rot. Structure101's specs, Lattix's partitions, Sonargraph's DSL,
   Backstage's YAML, arc42's twelve sections, C4's component diagrams, Sourcegraph's Notebooks,
   Swimm's docs, CodeSee's tours. Every one of them stayed niche or died. The two things in this
   survey that spread — ArchUnit-style assertions and CodeScene — spread because **neither asks
   you to author a model**.

2. **Depth and freshness trade against each other.** Symbol-accurate models need a compiling
   build, which realistically only exists on a developer's machine — hence Sourcetrail and
   Understand are manual-refresh desktop apps. CodeSee got perfect CI freshness by keeping its
   unit shallow: files and imports. Nobody has both, and the LLM era has not changed this so much
   as hidden it behind a generation step whose freshness is worse than either.

3. **The value must be legible in the first minute.** Sourcetrail's founders named this as failure
   mode #1 — *"the supposed value is not immediately clear to each user"* — and CodeSee's founder
   restated it as needing to cover more languages, stacks and IDEs. The demo only lands if it
   lands on *your* repo. DeepWiki's entire adoption advantage is that swapping one letter in a URL
   clears this bar.

4. **Episodic use cannot carry a subscription.** *"call graph visualizers are the sort of thing
   that you would need only once or only every once in a while."* Onboarding is by definition a
   week-one activity, and a tool used in week one is priced against a tool used every day.

5. **The incumbent covers 80%.** An IDE with two panes, go-to-definition and find-references
   already answers most navigation questions for free. Anything that only beats it on *friction*
   loses to *already installed*.

6. **Code cannot tell you why.** Raised independently against Mutable.ai (Jan 2024), Greptile (Mar
   2024) and DeepWiki (Aug 2025): *"Good documentation doesn't explain what the code does, it
   explains why the code is written the way it is … You can't really guess those things by looking
   at code."* DeepWiki reads only the codebase, by its founder's own confirmation. Only Unblocked
   (Slack and tickets) and Augment's Context Lineage (git history with per-diff summaries) attack
   this directly.

7. **Confident wrongness costs more than absence.** Verification cost exceeds writing cost once
   the reader has to check every claim — *"Would I get a little refund for each mistake I find?"*
   And the errors are not random: file size gets mistaken for architectural importance, and stale
   names get read as current behaviour.

8. **Generated docs impose costs on people who never opted in.** Predicted on HN in Jan 2024,
   realised on schedule by Aug 2025: AI-slop bug reports traced to a generated wiki, generated
   pages outranking official docs in search, no takedown path.

9. **Regeneration destroys the referent.** The loudest complaint about Google Code Wiki was not
   inaccuracy but instability: *"If I could be in the middle of reading it, and the next day it's
   completely different, that's a huge waste of my time."* A map you cannot return to, cite, or
   share a link into is not a map.

10. **Nobody dies of bad retrieval; they die of no wedge.** Every survivor attached comprehension
    to an event that already existed in the workflow — a PR, an agent tool call, a file save.
    Every casualty asked a human to go somewhere and ask a question. Q&A requires the human to
    already know what to ask; a diff supplies the question *and* arrives on a webhook.

11. **The compliance buyer is the only one who reliably pays.** The two tools in this survey sold
    to developers are gone; the one sold to auditors and defence programmes is on version 8.0.

12. **The picture was never the thing.** 62% of the entire software-visualisation literature has
    no strong evaluation and 46% was "evaluated" by the authors describing how they imagine the
    tool being used (Merino et al., JSS 2018). When you ask professionals, **over half question
    the need for such tools at all**, **2D is better accepted by nearly all**, and the decisive
    variables are **IDE integration and query precision**, not visual overview (Sensalire et al.,
    SOFTVIS 2008). And **code has no intrinsic spatial mapping** — *"unlike sketching buildings or
    mechanical parts, code is an abstract entity with few spatial features"* (Cherubini et al.,
    CHI 2007). Any spatial treatment is a chosen convention that must earn its place, and
    **automatically generated diagrams are valued *less* than hand-drawn ones** because they don't
    require externalising a mental model and don't flex their level of detail.

13. **Structural maps answer the cheap questions.** Sillito's categories 1–2 — where do I start,
    what is next to this — are the ones every tool here answers, and they skew heavily to
    newcomers. Categories 3–4 — how is this feature implemented across these types, what is the
    total impact of this change — are the ones that are permanent, hard, and least tool-supported.
    Meanwhile the *most expensive* questions aren't structural at all: **rationale ranks #1 among
    hard questions (LaToza & Myers 2010) and #1 among serious problems at 66% (LaToza et al. 2006)**,
    and design documents are *"write-only media"*. **Coworkers are the most frequent information
    source**, serving 13 of 21 needs (Ko et al. 2007).

---

## 11. The gap Argo could occupy

Four things are genuinely unclaimed, and Argo is unusually placed for three of them.

**a) Declared staleness is an open field.** Every vendor solved *"how do I trust this claim"* the
same way — a citation back to source — and **not one shipped an answer to "how do I know this is
stale."** No product surveyed has a staleness indicator, an as-of-commit stamp, or a confidence
signal. Argo already has the vocabulary and the rule: DIRECT / DERIVED / CONVENTION as a property
of each rendered fact, and **degrade-down** so ambiguity resolves to the lower tier and Argo never
renders a false DIRECT (`docs/domain/honesty-tier.md`, ADR-0008). Applied to an atlas node this is
not a nice-to-have; it is the specific defence against failure modes 7 and 9. A node that says
*"this claim was DERIVED at commit `abc123`, and 40 commits have landed in this subtree since"* is
something nobody ships. Feeds [#649](https://github.com/milad-alizadeh/argo/issues/649) directly.

**b) Argo watches the sessions that write the code — which is the "why" nobody has.** Failure mode
6 is the most durable objection in the survey, raised independently across three years, and the
only two tools attacking it reach for *adjacent systems*: Unblocked ingests Slack and Jira,
Augment summarises git diffs. Argo has something better and closer. It observes the Turn that
produced the change, the Plan the agent was working, the Work Item the Session was bound to, and
the Outcome. **The prompt that caused a module to exist is a stronger primary source for "why"
than a commit message, a Slack thread, or an LLM's guess from the code.** That is a corpus no
competitor can reconstruct after the fact, and it turns the atlas from "what the code appears to
do" into "what someone was trying to do." It also has an honesty tier already — a fact from a
managed Session's transcript is DERIVED read-verbatim, not inferred prose.

**c) Behavioural derivation with zero setup is the only proven adoption path, and it composes.**
CodeScene is the survey's cleanest counterexample to the authoring tax: point it at a git repo and
it produces a generated, drillable, behaviourally-ranked map with no build, no annotations and no
authored model. The Atlas is required to work on *"any registered Project, no prior setup"* (#643),
which puts it in exactly that lane — and Argo can join something CodeScene cannot: git history
*plus the sessions*. CodeScene's ranking answers "where does this organisation spend its time";
Argo's could answer "where has work actually happened, by whom or by which agent, toward which
Work Item." Worth also stealing CodeScene's public commitment never to evaluate individuals, since
Argo's `Person` axis makes the same hazard available.

**d) A stable, addressable, drillable artefact — the thing regeneration keeps destroying.** The
tension in failure mode 9 is real and the two escapes so far are both retreats: DeepWiki
accidentally avoids it by mostly not refreshing, and Windsurf Codemaps avoids it by making the
map per-task and disposable. #643 has already ruled out both — the Atlas is persisted and
refreshed as commits land. The unsolved design problem is therefore **what invalidates a node
without rewriting the reader's world overnight**, and the survey points at an answer: refresh on
**detected divergence** (Komment's design), scope the update to the affected node (Driver's
commit-scoped partial regeneration), and make the node's identity stable across refreshes so a
link into it survives. That is a #646 + #649 question, and it is the one the LLM-era tools have
most conspicuously failed.

**e) The literature already wrote the brief, and nobody has built it.** Cherubini et al. (CHI
2007), after finding that developers overwhelmingly sketch rather than reach for
reverse-engineering tools, named what would change that: *"A visualization that was spatially
stable, yet up-to-date with the evolution of the code, could help a developer stay oriented … If
the visualization were shared among the development team then ad-hoc meetings, design reviews, and
especially onboarding could benefit from the common ground that it would create."* **Spatially
stable, current, shared, variable-altitude.** Every tool in this survey has three of those at
most: CodeSee had freshness and stability but no altitude above files; Sourcetrail had altitude but
no freshness and no sharing; DeepWiki has altitude and sharing but neither stability nor freshness.
Nineteen years later the combination is still open — and it is very close to what #643 already
specified independently.

Three design constraints the research hands the Atlas directly, all of them arguments for #646 and
#648:

- **The unit that matters is small and scattered, and nothing holds it.** The working set for a
  real task was a **median 33 lines — 7% of the program — spread across 2–4 files**, revisited 18
  times, held only in tab and scroll state and lost on every task switch; **only 2 of 10 developers
  used bookmarks and both abandoned them** (Ko et al., TSE 2006). Meanwhile **35% of working time
  goes to navigation mechanics** and **88% of searches produce nothing used later**. A node that is
  a *stable, addressable, revisitable* grouping of scattered lines is better-evidenced than any
  diagram.
- **Altitude must be changeable at any moment.** Comprehension switches opportunistically between
  reading strategies at any abstraction level (von Mayrhauser & Vans 1995), and *"the level of
  abstraction differs with every conversation and even within a conversation"* (Cherubini et al.).
  Whatever a node is, moving up and down cannot cost the reader their place.
- **A narrated walkthrough is the best-evidenced onboarding form.** Dagenais et al. (ICSE 2010),
  following 18 newcomers into 18 real projects, found the recurring aids were a **mentor** and the
  transfer mechanism was the **walkthrough**, concluding that exploration tools should *complement,
  not replace, human guides*. That is unusually direct support for the voice direction #643 already
  committed to — with the caveat from Balfroid et al. (2026) that **developers trust descriptions
  they believe were human-written more than ones they believe were generated**, so how a node
  declares its provenance is not cosmetic.

Two things to be careful of, since the survey is unambiguous about them:

- **Onboarding alone will not sustain the feature.** Failure mode 4 killed a whole generation. The
  Atlas needs a use that recurs — plausibly, the same node that teaches a newcomer is what a
  Session reads before it edits, and what a reviewer reads to judge a Diff. Argo has both events
  already; a comprehension surface with no wedge into a recurring event is the survey's single
  most reliable predictor of death.
- **The reader may be a model.** By 2026 the unit of knowledge has migrated from file/symbol →
  module article → spatial map → **agent-consumable context bundle**; Augment killed its
  human-facing product and shipped the engine as MCP, JetBrains shipped Context for foreign
  agents, Sourcegraph re-aimed search at agents, and 60k+ repos now carry an `AGENTS.md`. Google
  Code Wiki is the outlier still betting on a human-readable artefact, and the loudest complaint
  was about that artefact. Argo's atlas is explicitly for a *person*, and shaped for voice — which
  is a genuine differentiator, but it means the prose-per-node requirement in #646 is carrying
  more weight than it looks. Ma et al. (ASE 2026) is a useful check here: for an *agent* reader,
  vision-only repo graphs made things worse, and **hybrid text+vision** cut tokens 26% at equal
  accuracy — so a node that reads well aloud and carries a small precise structure is the shape
  that serves both readers.
- **Do not let a model grade the atlas.** Balfroid et al. (2026) evaluated exactly this and found
  LLM annotations of code-tour quality unreliable, with *"sycophancy, confabulation, and
  incoherence … pervasive."* Combined with a code-summarisation hallucination base rate that runs
  to two-thirds on hard inputs (PACMSE 2026), the honesty tier is not a garnish on the content
  model — it is the mechanism that makes generated prose safe to render at all.

---

## Unverified

Claims that circulate widely but could not be pinned to a primary source, and should not be cited
as fact: the 750-file VS Code auto-index threshold (the 2,500-file cap *is* primary, from the
product's own error string); Cursor's 10-minute Merkle poll interval and index expiry; "Riptide"
as the name of Windsurf's indexing engine; Google Code Wiki's per-commit regeneration trigger;
Qodo Aware's refresh cadence and knowledge-graph architecture; Mutable.ai's acquisition by
Alphabet; the attribution to Boris Cherny that Claude Code dropped a vector DB for agentic search;
the "CodeSee maps went stale / JS-only / pretty but unused" critique, which appears only in
unsourced secondary comparison content; Sourcegraph layoffs after June 2022; numeric pricing for
NDepend, Sonargraph and Lattix; CAST's CISQ/OMG standards role; Stepsize's current status.

From the academic pass, where the paper itself was unreachable and the figure comes from a slide
deck, abstract, or secondary summary — **cite the source, not the number**: the Maalej TOSEM 2014
survey percentages (n=1,477; paper closed, preprint dead, no archive copy); the Roehm ICSE 2012
counts (from the authors' own conference slides, not the paper); Littman et al.'s subject counts —
the widely repeated "10 programmers / 250 lines" is secondary only; the VariCity/JSS 2023
controlled-experiment *results* (design only, from secondary sources); Merino et al.'s 2016
"disconnect" rankings; the Hallu-Eval percentages (ACM DL 403); the Sourcetrail discontinuation
*reasons* as reported in trade press, as distinct from the founders' own blog post quoted in §4,
which is verified.

Two structural gaps in the evidence base, worth stating plainly: **there is no independent
replication of the Wettel 2011 CodeCity experiment**, and **there is no credible industry survey
quantifying software-visualisation adoption** — the strongest datum is a direct observation of 28
professionals in which zero used a comprehension tool. Likewise **no peer-reviewed onboarding
ramp-up duration** could be found; the circulating "3–6 months to productivity" figures are
vendor-blog only and are not citable.

## Sources not yet read

- Simon Brown, *Reverse-engineering Architecture Diagrams from your Java app*, JFokus 2025 —
  [slides PDF](https://www.jfokus.se/jfokus25-preso/Reverse-engineering-Architecture-Diagrams.pdf).
  The best primary source on the current limits of deriving architecture from code; exceeded the
  fetch size limit.
- [HN 39522042](https://news.ycombinator.com/item?id=39522042) — skeptical reaction to the
  CodeScene/SonarQube benchmark; rate-limited.
