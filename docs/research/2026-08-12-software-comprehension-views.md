# The views people use to understand software

**Date:** 2026-08-12 · **For:** wayfinder [#661](https://github.com/milad-alizadeh/argo/issues/661), blocking the node/edge question on [#646](https://github.com/milad-alizadeh/argo/issues/646) and part of the [#643 Project Atlas map](https://github.com/milad-alizadeh/argo/issues/643) · **Status:** primary-source survey, several claims measured on this repo at `ff9cd21`

## The question

[#645](https://github.com/milad-alizadeh/argo/issues/645) catalogued ~70 **tools**. This one catalogues the
**representations** — the views themselves, independent of who renders them. Per view: what question it
answers, what input it needs, which of [#644](https://github.com/milad-alizadeh/argo/issues/644)'s extraction
tiers that input sits in, what it is bad at, where it breaks at scale. Then the part #646 actually hangs
on: **how the views connect** — which are one graph at different resolutions, which are genuinely
different projections, and which pairs are known to conflict.

## Method

Seven strands, each against primary sources only — the paper, the spec, the official docs, the source.
Where a primary source could not be reached the claim is marked **[unverified]** in place rather than
dropped; §"What could not be verified" lists every one. Claims about *this* repo were measured, not
recalled: `git ls-files`, `git grep`, `git log`, and `wc` at commit `ff9cd21`, 696 tracked Swift files /
56,870 lines, of which **484 non-test source files / 34,138 lines** across four first-party modules.

**One correction to the brief's framing up front.** #644's tiers — Read / Parse / Resolve / LLM — were
derived from *what a repo can be made to confess*. Applied to views, they do not span the space. Two more
are needed and both are load-bearing:

- **Author** — a human wrote it, and no extractor produces it. This is the majority tier in the inventory
  below, and it is not the same as #644's LLM tier: an LLM *infers* from artifacts, whereas a context map's
  edges encode facts (team politics, negotiating power) that are in no artifact at all.
- **Runtime** — needs the system *running*, with instrumentation attached. #644's tiers are all
  static-repo tiers; nothing in them reaches a trace, a profile, or a service map. Runtime is the only
  tier that answers "what actually happened," and it is the only one Argo cannot obtain from a clone.

---

## Inventory

Tier key: **Read** (manifests, config, filesystem, git) · **Parse** (AST, no resolution) · **Resolve**
(types, references, a build) · **Runtime** (a running instrumented system) · **Author** (a human wrote it)
· **LLM** (inferred from artifacts).

### Framework and prescribed view sets

| View | Question it answers | Input | Tier | Bad at | Known scale limit | Primary source |
|---|---|---|---|---|---|---|
| **ISO/IEC/IEEE 42010 architecture description** | Whose concerns does this cover, by what conventions, and where do the views disagree? | stakeholders, concerns, viewpoints, correspondences | Author | telling you what to draw; it prescribes no viewpoint at all | none numeric; requires only that inconsistencies be *recorded* | [42010:2022 preview](https://cdn.standards.iteh.ai/samples/74393/fc7b7f103d8446a4b87a3261e31370d3/ISO-IEC-IEEE-42010-2022.pdf) · [companion site](http://www.iso-architecture.org/42010/) |
| **4+1 (logical/process/development/physical/scenarios)** | Five stakeholder-specific cuts of one architecture | architect, scenario-driven | Author | keeping five views in step under change | *"the larger the project, the greater the distance between these views"* | [Kruchten, IEEE Software 1995](https://www.cs.ubc.ca/~gregor/teaching/papers/4+1view-architecture.pdf) |
| **arc42 (12 sections; §5 building block, §6 runtime, §7 deployment)** | Where do I file this piece of architectural knowledge? | human author | Author | anything machine-checkable; no correspondence apparatus between §5/§6/§7 | none documented; a one-page "canvas" is the offered reduction | [arc42.org/overview](https://arc42.org/overview) |
| **C4 L1 System Context** | How does this system fit into the world? | human author | Author | internals | — | [c4model.com/diagrams](https://c4model.com/diagrams) |
| **C4 L2 Container** | What are the separately runnable/deployable pieces, and their tech? | human author | Author | behaviour, data, process (FAQ scope statement) | — | [c4model.com/abstractions/container](https://c4model.com/abstractions/container) |
| **C4 L3 Component** | What are the major groupings inside one container? | human author | Author | staying true — it is the level closest to code and hand-maintained | ~600+ components ⇒ split into many focused diagrams, use a *modelling* not diagramming tool | [C4 FAQ](https://c4model.com/faq) |
| **C4 L4 Code** — *near-dead end* | How is one component implemented? | IDE/tooling | Resolve | being worth maintaining | *"not recommended for anything but the most important or complex components"* | [c4model.com/diagrams/code](https://c4model.com/diagrams/code) |
| **Structurizr workspace (one model, N views)** | The C4 questions, with element identity guaranteed shared across views | hand-written DSL | Author | drift from code — "models as code" means *beside* the code, not derived from it | — | [docs.structurizr.com/dsl/language](https://docs.structurizr.com/dsl/language) |
| **UML class diagram** | What types exist and how do they relate? | author, or Resolve-tier extraction | Author/Resolve | the 7/11 survivor in practice, but says nothing about runtime | see UML row below | [OMG UML 2.5.1](https://www.omg.org/spec/UML/2.5.1/) · [Petre ICSE 2013](https://www.pragmadev.com/downloads/UmlInPractice.pdf) |
| **UML sequence / interaction** | In what order do which participants exchange what, for one scenario? | author, or a trace | Author/Runtime | data (spec-level exclusion); completeness; honestly rendering concurrency | first casualty of trace size; real traces 10⁴–10⁷ calls, max nesting depth 466 | [UML 2.5.1 §17](https://www.omg.org/spec/UML/2.5.1/PDF) · [Cornelissen & Moonen](https://web.archive.org/web/2018/http://swerl.tudelft.nl/twiki/pub/Main/TechnicalReports/TUD-SERG-2008-005.pdf) |
| **Statechart (authored)** | What sequences of events are legal; what mode is it in? | human author | Author | anything not modal; contradictions are unpoliced | avoids the flat-FSM blow-up (two 1,000-state components ⇒ 10⁶ product states); no measured ceiling for authored charts | [Harel 1987](https://dubroy.com/refs/Statecharts_a_visual_formalism_for_complex_systems.pdf) |
| **UML activity** | What is the flow of work? | author | Author | 6/11 users in Petre; overlaps BPMN | — | [UML 2.5.1](https://www.omg.org/spec/UML/2.5.1/) |
| **UML deployment** | What artifact runs on what node, over what communication path? | author | Author | being current | — | [UML 2.5.1 §19](https://www.omg.org/spec/UML/2.5.1/PDF) |
| **UML use case diagram** — **dead end** | What actors do what? | author | Author | everything; one long-term user called it *"totally useless"* | 1 of 11 selective users | [Petre ICSE 2013](https://www.pragmadev.com/downloads/UmlInPractice.pdf) |
| **UML communication/collaboration** — **dead end** | same content as sequence, different layout | author | Author | — | *"never mentioned"* by any of Petre's 50; *"least popular"* in Dobing & Parsons | [Petre ICSE 2013](https://www.pragmadev.com/downloads/UmlInPractice.pdf) |
| **UML timing diagram** — **dead end** | when do state changes occur on a time axis? | author | Author | — | conformant tools are *"not required to implement"* it | [UML 2.5.1 §17.11](https://www.omg.org/spec/UML/2.5.1/PDF) |
| **UML component / composite structure / object / package / profile** — **dead ends** | assorted structural cuts | author | Author | — | absent from every empirical usage study found | [UML 2.5.1 Annex A](https://www.omg.org/spec/UML/2.5.1/PDF) |
| **SysML requirement / parametric / allocation table** | What requirement does this satisfy; what maps to what across diagrams? | author | Author | — | the **allocation table** is 42010's correspondence idea given tabular form | [OMG SysML](https://www.omg.org/spec/SysML/) · [diagram types](https://sysml.org/sysml-faq/what-are-sysml-diagram-types.html) |
| **Rozanski & Woods: 7 viewpoints × 10 perspectives** | Structural slices crossed with quality properties | author | Author | authoring cost of a 2-D grid | — | [viewpoints](https://www.viewpoints-and-perspectives.info/home/viewpoints/) |
| **Siemens 4 views (conceptual/module/execution/code)** | Where does design intent map onto files and processes? | author | Author | dynamic properties — UML *"works well for… static structure… much more readily described… than the dynamic"* | — | [Hofmeister/Nord/Soni WICSA1 1999](https://link.springer.com/content/pdf/10.1007/978-0-387-35563-4_9.pdf) |

### Structural graph views

| View | Question it answers | Input | Tier | Bad at | Known scale limit | Primary source |
|---|---|---|---|---|---|---|
| **Module / package map (filesystem-derived)** | What are the units, and what contains what? | manifest + directory walk | **Read** | *being the architecture* | **59–92% of ground-truth components do not correspond to a package or directory** | [Garcia ICSE 2013 SEIP](https://web.archive.org/web/2019id_/http://softarch.usc.edu/~josh/pubs/icse13seip-id80-p-16554-preprint.pdf) |
| **Import / dependency graph** | What declares a dependency on what? | source imports | **Parse** | runtime wiring; a lower bound that also over-reports unused includes | Chromium: 18,698 files / **1,183,799 include deps** vs a 67-cluster human architecture | [dependency-cruiser FAQ](https://github.com/sverweij/dependency-cruiser/blob/main/doc/faq.md) · [Lutellier TSE 2017](https://jgarcia.ics.uci.edu//wp-content/uploads/lutellier_tse_2017.pdf) |
| **Call graph (static)** | Who can call whom? | whole program + entry points | **Resolve** | reflection, native/JVM-initiated calls, dynamic property access, `eval` | Java "Hello World" = **5,313 methods / 23,000+ edges**; 0-CFA edge recall 30–58% | [Helm et al. ISSTA 2024](https://www.opal-project.de/articles/TotalRecall@ISSTA24.pdf) · [Ali & Lhoták ECOOP 2012](https://plg.uwaterloo.ca/~olhotak/pubs/ecoop12.pdf) |
| **Design Structure Matrix / propagation cost** | How far does a change propagate? | a dependency relation | Parse/Resolve | absolute claims — *"modularity… in absolute terms has no meaning"* | scales better than node-link; Mozilla 17.35% → 2.78% PC after redesign | [MacCormack, Rusnak & Baldwin](https://www.hbs.edu/ris/Publication%20Files/05-016.pdf) |
| **Core-periphery ("hidden structure")** | Which elements are in the largest cyclic group? | visibility matrix | Parse/Resolve | *"cannot be inferred from standard measures of coupling nor from DSMs based on the architect's view alone"* | 1,286 releases / 17 apps: core mean 16%, median 9%, range 1–75% | [Baldwin, MacCormack & Rusnak](https://core.ac.uk/download/28943272.pdf) |
| **Layered architecture diagram** | Which direction is "up"? | human author | **Author** | being checkable — import edges carry no intent | — | [Kruchten 1995](https://www.cs.ubc.ca/~gregor/teaching/papers/4+1view-architecture.pdf) |
| **Layering as an executable rule** (ArchUnit, dependency-cruiser, `swift-boundaries.sh`) | Does the code obey the layering we declared? | authored rule + extracted edges | Author + Parse | classes in no layer are invisible unless you opt in | `freeze()` exists because grown projects show *"hundreds or even thousands of violations"* | [ArchUnit guide](https://www.archunit.org/userguide/html/000_Index.html) |
| **Reflexion model** | Where does the authored model agree with, contradict, and miss the code? | high-level model + **hand-written map** + source model | Author + Parse | the map is the cost, and it grows | Excel: 1.2 MSLOC, map **170 → 1,425 entries**, 1 day + 4 weeks | [Murphy, Notkin & Sullivan FSE 1995](https://www.cs.ubc.ca/~murphy/papers/rm/reflexion_model_fse95.pdf) · [Excel case study](https://www.cs.ubc.ca/~murphy/papers/rm/rm-case-study.pdf) |
| **Recovered architecture (ACDC, ARC, Bunch, LIMBO, WCA, ZBR)** | Can the module view be inferred rather than authored? | dependency graph + clustering | Parse/Resolve | **accuracy** | best avg **MoJoFM 58.76% (ARC) / 55.94% (ACDC)**; c2c majority match "under 20%" | [Garcia, Ivkovic & Medvidovic ASE 2013](https://web.archive.org/web/2019id_/http://csse.usc.edu/csse/TECHRPTS/2013/reports/usc-csse-2013-508.pdf) |
| **Clone / duplication map** | Where is the same code twice? | token stream | **Parse** | telling deliberate from accidental | 5–20% of a typical system; JDK: longest clone 627 lines, generator-produced | [Roy & Cordy TR 2007-541](https://research.cs.queensu.ca/TechReports/Reports/2007-541.pdf) · [CCFinder](https://ir.library.osaka-u.ac.jp/repo/ouka/all/51063/arou_3_22.pdf) |

### Behavioural and dynamic views

| View | Question it answers | Input | Tier | Bad at | Known scale limit | Primary source |
|---|---|---|---|---|---|---|
| **Trace-derived sequence diagram** | Which concrete objects exchanged what, in what order, on this run? | instrumented execution | **Runtime** | repetition — measured **93.85–99.99%** repetitiveness | ant-selfbuild **12,135,031 calls / 1,404 unique**; azureus max depth **466** | [Cornelissen & Moonen](https://web.archive.org/web/2018/http://swerl.tudelft.nl/twiki/pub/Main/TechnicalReports/TUD-SERG-2008-005.pdf) |
| **Inferred state machine (specification mining)** | What protocol does this API actually obey? | many *well-debugged* traces | **Runtime** | precision — high recall, accepts too much | precision **0.584 → 0.185 → 0.059 → 0.014** at 10/20/30/40 states | [Lo & Khoo SMArTIC](https://dl.comp.nus.edu.sg/server/api/core/bitstreams/0b338a5d-7bd2-4c46-bcb4-aef0194d187d/content) · [Ammons POPL 2002](https://static.aminer.org/pdf/PDF/000/545/960/mining_specifications.pdf) |
| **Control-flow graph / cyclomatic complexity** | In what orders can this unit execute; how many tests at minimum? | one function | **Parse** | data (McCabe's own concession); interprocedural structure | region-count shortcut needs a **planar** graph — it degrades exactly when you need it | [McCabe TSE 1976](http://www.literateprogramming.com/mccabe.pdf) · [Shepperd 1988](https://www.cs.du.edu/~snarayan/sada/teaching/COMP3705/lecture/p1/cycl-1.pdf) |
| **Execution trace / massive sequence view** | What actually happened during this run? | instrumented execution | **Runtime** | coverage — one scenario touched **7–12% of methods** | Tomcat 6.58M events / 48s; one industrial scenario **9.72×10⁸ events / 90 GB** | [Cornelissen et al. TSE 2009](https://web-backend.simula.no/sites/default/files/publications/Simula.SE.477.pdf) · [Zaidman PhD](https://azaidman.github.io/publications/azaidmanPhD_A4.pdf) |
| **Profile / dynamic call graph (gprof)** | Where did the time go, attributed to callers? | sampled execution | **Runtime** | recursion — *"time is not propagated from one member of a cycle to another"*; assumes every call to a routine costs the average | expected error = √n samples | [gprof, SIGPLAN '82](https://docs-archive.freebsd.org/44doc/psd/18.gprof/paper.pdf) |
| **Feature location** | Where does capability X *start*? | scenarios, or a query, or a seed | Runtime/Parse/LLM | finding the *full* extent — that is impact analysis, a different activity | 38% of techniques compared against anything; **5%** used a benchmark | [Dit et al. JSEP 2013](https://web.archive.org/web/2020/http://www.cs.wm.edu/~denys/pubs/JSME-FL-SurveyCRCV1.pdf) |
| **Concern graph (FEAT)** | Having found a scattered concern, how do I record and re-use that map? | human author + a seed + program model | Author + Parse | behaviour; seed-finding is explicitly out of scope | FEAT could not hold 1,489 classes in 256 MB; **83%** of fragments survived 6 months / 51% avg class change | [Robillard & Murphy TOSEM 2007](https://www.cs.mcgill.ca/~martin/papers/tosem2007.pdf) |
| **BPMN process model** | In what order does work happen, and who does each step? | human author | **Author** | business rules (author-confirmed deficit); agreement between readers | avg model uses **9 constructs** of ~110; two models differ by **7–8** constructs | [BPMN 2.0](https://www.omg.org/spec/BPMN/2.0/) · [zur Muehlen & Recker](https://link.springer.com/content/pdf/10.1007/978-3-642-36926-1_35.pdf) |

### Data, interface and deployment views

| View | Question it answers | Input | Tier | Bad at | Known scale limit | Primary source |
|---|---|---|---|---|---|---|
| **ER diagram from the catalog** | What entities exist and how do they relate? | `pg_dump -s`, `information_schema`, `sqlite_schema` | **Read** | undeclared relationships — an app-enforced join is invisible | Mermaid caps `maxEdges` at **500** by default | [Chen TODS 1976](https://www.csub.edu/~ychoi2/MI) · [PG information_schema](https://www.postgresql.org/docs/current/information-schema.html) |
| **ER from ORM schema** | Same, but including relationships the DB never declared | `schema.prisma`, Django models, `schema.rb` | **Read** | disagreeing with the DB; Rails explicitly denies source-of-truth status | — | [Django models](https://docs.djangoproject.com/en/stable/topics/db/models/) · [Rails migrations](https://guides.rubyonrails.org/active_record_migrations.html) |
| **OpenAPI / AsyncAPI surface** | What operations does this service *claim* to offer? | a description document | **Read** | truth — nothing binds description to implementation; open-world | — | [OAS 3.1](https://spec.openapis.org/oas/v3.1.0.html) · [learn.openapis.org](https://learn.openapis.org/introduction.html) |
| **GraphQL introspection** | What is the API surface, right now? | one query to a live server | Runtime (cheap) | usage — says a field exists, not that anyone calls it | — | [graphql-spec §4](https://raw.githubusercontent.com/graphql/graphql-spec/main/spec/Section%204%20--%20Introspection.md) |
| **gRPC reflection / protobuf descriptors** | Same, for RPC | a live server, or `protoc --descriptor_set_out` | Runtime / Read | **opt-in and usually off in production** | — | [gRPC reflection](https://grpc.io/docs/guides/reflection/) · [protobuf.dev](https://protobuf.dev/programming-guides/techniques/) |
| **Language API surface / API report** | What can a caller invoke, and did that set change? | a build | **Resolve** | which of 40 exports matters | — | [api-extractor](https://api-extractor.com/pages/overview/intro/) · [cargo-public-api](https://github.com/enselic/cargo-public-api) |
| **Deployment / topology (C4, UML)** | What runs where, talking to what? | human author | **Author** | being current | — | [c4model deployment](https://c4model.com/diagrams/deployment) |
| **Manifest topology (K8s, Compose, Terraform)** | Same, machine-readable | manifests, `kubectl get -o json`, `terraform graph` | **Read** | `spec` ≠ `status`; `terraform graph` shows *config dependency order*, not reality | — | [K8s objects](https://kubernetes.io/docs/concepts/overview/working-with-objects/) · [terraform graph](https://developer.hashicorp.com/terraform/cli/commands/graph) |
| **Service map from telemetry** | Which services actually call which, in production? | full instrumentation + collector | **Runtime** | completeness — filtered four times over | Dapper sampled **1/1024**, and as low as **0.01%**; 1/1 sampling cost **16.3%** latency | [Dapper](https://static.googleusercontent.com/media/research.google.com/en//archive/papers/dapper-2010-1.pdf) · [OTel sampling](https://opentelemetry.io/docs/concepts/sampling/) |

### Metric-driven and spatial views

| View | Question it answers | Input | Tier | Bad at | Known scale limit | Primary source |
|---|---|---|---|---|---|---|
| **Treemap** | Where is the mass in a weighted hierarchy? | tree + a numeric weight per leaf | **Read** | hierarchy — *"degenerates into a regular grid"* on balanced trees; nesting offset breaks area-proportionality | 1–2k files at VGA; **novices did better at 20–50 nodes, 1–3 levels** | [Shneiderman 1992](https://www.cs.umd.edu/~ben/papers/Shneiderman1992Tree.pdf) · [history](https://www.cs.umd.edu/hcil/treemap-history/) · [Squarified](https://vanwijk.win.tue.nl/stm.pdf) |
| **Code city** | What shape is this system, and where are the outliers? | packages/classes + 2–3 metrics | **Parse** | precise/"top-N" queries — a spreadsheet beats it | evaluated to 454 kLOC / 4,656 classes; documented failure is *interactivity*, not legibility | [Wettel & Lanza VISSOFT 2007](https://wettel.github.io/download/Wettel07b-vissoft.pdf) · [ICSE 2011 experiment](https://wettel.github.io/download/Wettel11a-icse.pdf) |
| **Hotspot / churn map** | Where will the defects be? | VCS history + LOC proxy | **Read** | absolute churn is near-useless (R² = .052) — the *ratios* are the finding | validated at 45 MLOC / 2,465 binaries; CodeScene visualisation degrades at "several thousands of files" | [Nagappan & Ball ICSE 2005](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/icse05churn.pdf) · [Graves TSE 2000](https://www.niss.org/sites/default/files/technicalreports/tr80.pdf) |
| **Change / temporal coupling map** | What else must I change? | transaction-grouped history | **Read** | precision — ROSE **29% precision / 33% recall** fine-grained | top-3 hit rate ~70%; rule computation "several days" | [Zimmermann TSE 2005](https://thomas-zimmermann.com/publications/files/zimmermann-tse-2005.pdf) · [Gall ICSM 1998](https://plg.uwaterloo.ca/~migod/846/papers/gall-coupling.pdf) |
| **Ownership map (measured)** | Which components are diffusely owned? | commit history + author identity | **Read** | attributing failures to changes; polarity flips by granularity | MINOR ρ = **.86–.93** pre-release (Vista/Win7); post-release Win7 collapses to .25 | [Bird et al. FSE 2011](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/bird2011dtm.pdf) · [Rahman & Devanbu ICSE 2011](http://macbeth.cs.ucdavis.edu/icse2011.pdf) |
| **CODEOWNERS (declared)** | Who *should* review a change to this path? | a hand-written file | **Read** | everything measured — it states policy, never authorship | **3 MB**, hard, silent, fail-open; invalid lines silently skipped | [GitHub docs](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners) |
| **Whiteboard sketch** — *the most-used view, and transient by design* | whatever two people need for ten minutes | two people and a marker | **Author** | persisting — *"subsequently lost"* | 427 developers surveyed; most drawings transient | [Cherubini et al. CHI 2007](https://files.software-carpentry.org/training-course/2012/08/cherubini-venolia-whiteboard-2007.pdf) |

### Narrative and knowledge views

| View | Question it answers | Input | Tier | Bad at | Known scale limit | Primary source |
|---|---|---|---|---|---|---|
| **ADR set** | Why is it this way, and what did we give up? | human author | **Author** | the present state; cross-repo decisions | **554 of 921** repos stop at 1–5 records; 278 edited ADRs on exactly one day, ever; max observed 73 | [Nygard 2011](https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions) · [Buchgeher IEEE Access 2023](https://doi.org/10.1109/ACCESS.2023.3287654) |
| **Domain glossary / ubiquitous language** | What do we mean by each term, and where does that meaning hold? | human agreement | **Author** | anything that changes faster than people agree; decays silently | none documented | [DDD Reference](https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf) |
| **Context map (DDD)** | What is our relationship to the team on the other side of each boundary? | human agreement | **Author** | **not derivable at all** — edges travel *"through non-technical channels"* | — | [DDD Reference p.29](https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf) |
| **README** | What is this and how do I run it? | human author | **Author** | *why* — **2.7%** of sections; status — 4.3% | 4,226 sections / 393 repos; classifier F1 **0.746** | [Prana et al. EMSE 2019](https://arxiv.org/pdf/1802.06997) |
| **Runbook / playbook** | What do I do right now, at 3am? | human author, alert-linked | **Author** | novel failure; teaching judgement (explicit SRE anti-pattern) | fastest-rotting view in the set | [Google SRE Ch.1](https://sre.google/sre-book/introduction/) · [Ch.28](https://sre.google/sre-book/accelerating-sre-on-call/) |
| **Code tour (CodeTour, Swimm)** | Walk me through this in reading order | human prose + machine anchors | Author + Read | prose that goes silently wrong while the anchor still resolves | explicit trade: pin to a commit (never stale, never current) or pin to nothing | [microsoft/codetour](https://github.com/microsoft/codetour) · [Swimm auto-sync](https://swimm.io/blog/how-does-swimm-s-auto-sync-feature-work) |
| **Literate program** — **dead end** | Why this code, in human-comprehension order? | author, inseparably | **Author** | four simultaneous error surfaces | Knuth: *"WEB may be only for the subset of computer scientists who like to write"* | [Knuth 1984](http://www.literateprogramming.com/knuthweb.pdf) |
| **Diátaxis (meta-view)** | Where does this prose belong and what is it obliged to do? | human author | **Author** | generation, staleness; validation is *a priori* | — | [diataxis.fr](https://diataxis.fr/) |
| **Mentor walkthrough** | Everything not written down | a human, live | **Author** | scaling; newcomers are socially inhibited from asking | *"complement, but should not replace, human guides"* | [Dagenais et al. ICSE 2010](https://www.cs.mcgill.ca/~martin/papers/icse2010.pdf) · [Begel & Simon ICER 2008](https://andrewbegel.com/papers/icer-begel-2008.pdf) |

**The shape of the table is itself the first finding.** Of ~50 views, the ones that answer *why*, *what
this means*, and *which direction is up* are all **Author** tier — no extractor produces any of them. The
ones that are cheap (Read tier) answer only *what is declared*. And the two views that answer the most
interesting questions — *what actually calls what* and *what do we actually mean* — sit in **Runtime** and
**Author**, the two tiers Argo cannot obtain from a clone.

---

## 1. Framework views: everyone names the problem, nobody solves it

### 42010 gives the vocabulary and declines the mechanism

ISO/IEC/IEEE 42010 is a meta-framework: it prescribes no viewpoint. Its scope statement is explicit that
*"this document does not specify the processes, architecting methods, models, notations, techniques or
tools by which an AD is created"*
([42010:2022 preview](https://cdn.standards.iteh.ai/samples/74393/fc7b7f103d8446a4b87a3261e31370d3/ISO-IEC-IEEE-42010-2022.pdf)).

What it *does* contribute is the vocabulary for the connection question. From the standard's own
companion site, maintained by its editor
([iso-architecture.org/ieee-1471/cm](http://www.iso-architecture.org/ieee-1471/cm/)):

> "Correspondences capture relationships between AD Elements. Correspondences and Correspondence Rules are
> used to express and enforce architecture relations such as composition, refinement, consistency,
> traceability, dependency, constraint and obligation within or between ADs."

And the conformance requirement is **bookkeeping, not verification** — an AD conforms by *"linking together
those views with correspondences and **recording any known inconsistencies between views**"*
([FAQ](http://www.iso-architecture.org/42010/faq.html)). The editor's own AD template makes this concrete:
*"For each identified correspondence rule, record whether the rule holds (is satisfied) or otherwise record
all known violations"*
([template](http://www.iso-architecture.org/42010/templates/42010-ad-template.pdf)). A conformant
architecture description may ship with inconsistencies, provided they are written down. Checking machinery
is optional viewpoint furniture: a viewpoint *"might define… correspondence rules, criteria and methods for
checking completeness (of views) or consistency (between views)"*
([AD requirements](http://www.iso-architecture.org/42010/ads/)).

The 2022 edition says plainly that it does not solve this: *"This document does not explicitly address
completeness or correctness regarding the inclusion of particular elements in an AD."*

### Kruchten states the divergence as a scale law

4+1's five views are the canonical prescribed set. The paper opens on the ambiguity it exists to fix —
*"Are the boxes representing running programs? Or chunks of source code? Or physical computers?… Usually it
is a bit of everything"* — and closes with the tailoring rule: *"Not all software architecture need the
full '4+1' views. Views that are useless can be omitted… **The scenarios are useful in all
circumstances**"* ([Kruchten 1995](https://www.cs.ubc.ca/~gregor/teaching/papers/4+1view-architecture.pdf)).

Its most useful sentence for #661 is a stated law about how views drift apart:

> "The logical and development views are very close, but address very different concerns. **We have found
> that the larger the project, the greater the distance between these views.** Similarly for the process and
> physical views: the larger the project, the greater the distance between the views."

He also notes the runtime mapping can change with no code change at all — UNAS gave *"data-driven means of
mapping the process architecture onto the physical architecture allowing a large class of changes in the
mapping **without source code modifications**."* A deployment view can go stale while every file is
untouched.

### C4 survives by refusing levels

C4's most-cited operational advice is a subtraction: *"**you don't need to use all 4 levels of diagram;
only those that add value — the system context and container diagrams are sufficient for most software
development teams**"* ([c4model.com/diagrams](https://c4model.com/diagrams)). Level 4 (Code) is explicitly
discouraged: *"This level of detail is not recommended for anything but the most important or complex
components"*, and *"most IDEs can generate this level of detail on demand"*
([code](https://c4model.com/diagrams/code)). **That is the only place in the entire framework cluster where
an authored view is handed to a machine — and it exists as the level you are told not to hand-author.**

C4's FAQ is unusually candid about scope: it covers *"the static structures"* only, and explicitly excludes
business processes, workflows, state machines, domain models and data models, directing you to UML, BPMN or
ArchiMate instead ([FAQ](https://c4model.com/faq)). At ~600+ components the guidance is not one diagram but
many focused ones, and *"using modeling tools rather than diagramming tools enables this approach more
effectively."*

Structurizr is that modelling tool, and it is the one entry in the survey where **views are projections, not
artifacts**: you author a workspace once, and `systemLandscape`, `systemContext`, `container`, `component`,
`dynamic`, `deployment` and `filtered` views are selections over it
([DSL reference](https://docs.structurizr.com/dsl/language)). That structurally eliminates the
inter-view inconsistency 42010 can only ask you to record. It does not eliminate drift from the *code* —
"models as code" means the model lives beside the code in git, not that it is derived from it.

### UML: 14 diagram types, 3 survivors, and the reason

The OMG spec (`formal/17-12-05`, **796 pages**) defines 14 diagram types across structure and behaviour
([UML 2.5.1](https://www.omg.org/spec/UML/2.5.1/)). The empirical record on which survive is consistent
across two decades.

Petre's ICSE 2013 study — semi-structured interviews with **50** practitioners, one per company — found:

| Category | Count |
|---|---|
| **No UML** | **35 / 50** |
| Retrofit (to satisfy management/customers) | 1 |
| Automated code generation | 3 |
| **Selective** (informal, adapted, discarded when done) | **11** |
| **Wholehearted** | **0** |

Of the 11 selective users: class diagrams 7, sequence 6, activity 6, state machine 3, use case diagrams 1.
*"Some informants also specified elements of UML that they never use: state machines, use case diagrams.
Some elements of UML were never mentioned: communication / collaboration diagrams"*
([Petre 2013](https://www.pragmadev.com/downloads/UmlInPractice.pdf)). Dobing & Parsons' earlier survey of
182 UML users reached the same shape: *"Only Class Diagrams are being used regularly by over half the
respondents, with Sequence and Use Case Diagrams used by about half"* (quoted verbatim in Petre's related
work; CACM returned 403 to direct fetch — **[unverified against the original]**).

The stated reason for rejection is the consistency problem, in an informant's own words:

> "**There is no check on consistency, redundancy, completeness or quality of the model what so ever.
> Modeling a small project may not be a problem, but handling large projects in UML forces you to go over the
> entire model every time you want to change anything, to see what the consequences for the rest of the model
> will be.**"

Forward & Lethbridge (113 practitioners) found the same at 68% agreement: *"The biggest perceived problem of
model-centric approaches is keeping the model up-to-date with the code."* And Nugroho & Chaudron's earlier
survey found that *"systematic approaches to maintaining correspondence are rarely used in practice."*

The survivors share a property: they are **kept small on purpose**. Petre's §E documents enthusiastic users
narrowing scope deliberately — *"80/20 rule: express that key part of the system that gives context for
everything else"* — and one informant's whole-system diagram, spanning pages plus thousands of wiki words,
came with the author's own doubt *"that the documentation would be maintained as the system evolved."*

---

## 2. Structural views: the compression is the view

### The module map is not the architecture

The single hardest empirical result in this survey. Garcia et al. obtained **ground-truth architectures** by
having systems' own architects certify recovered ones — Bash's certifier *"has been the primary developer of
Bash for over 17 years"*; ArchStudio's was *"its primary architect"*. Recoverers spent ~100 person-hours per
system, certifiers 7. Then they measured how well the *package/directory hierarchy* matched the certified
architecture:

| System | Components | Span multiple packages | Share a package | **Not a package** |
|---|---|---|---|---|
| Bash | 25 | 6 (24%) | 17 (68%) | 23 (**92%**) |
| Hadoop | 68 | 18 (26%) | 40 (59%) | 58 (**85%**) |
| OODT | 217 | 43 (20%) | 85 (39%) | 128 (**59%**) |
| ArchStudio | 54 | 18 (33%) | 0 (0%) | 18 (**33%**) |

> "the components in a ground-truth architecture **rarely have a direct correspondence to a system's package
> structure**."
> — [Garcia et al., ICSE 2013 SEIP](https://web.archive.org/web/2019id_/http://softarch.usc.edu/~josh/pubs/icse13seip-id80-p-16554-preprint.pdf)

Components are also small and skewed: mean component size is **0.5%–4% of the system**, 52–72% of components
are "small", and 5–24% are singletons that *"tended not to be explicitly called out in documentation."*

### And it cannot be inferred either

The obvious response — cluster the dependency graph instead — is measured and it fails. Six techniques in
nine variants, eight ground-truth architectures, ~1,540,000 candidate architectures computed:

| Technique | Avg MoJoFM |
|---|---|
| ARC | **58.76%** |
| ACDC | **55.94%** |
| Bunch-NAHC | 51.34% |
| Bunch-SAHC | 46.16% |
| WCA-UE | 43.58% |
| WCA-UENM | 42.04% |
| ZBR-Tok | 38.98% |
| ZBR-Uni | 38.10% |
| LIMBO | 31.47% |

> "on the whole, **all of the studied techniques performed poorly**… For the three strength levels of the c2c
> analysis, the techniques **on average obtained matches for under 20% of ground-truth clusters**."
> "relying upon even these top-performing techniques alone is **insufficient to reliably perform an
> architecture's recovery in general**. This unpredictability… suggest[s] that effective software architecture
> recovery is likely to **require extensive manual intervention** — the very thing automated techniques have
> aimed to eliminate."
> — [Garcia, Ivkovic & Medvidovic, ASE 2013](https://web.archive.org/web/2019id_/http://csse.usc.edu/csse/TECHRPTS/2013/reports/usc-csse-2013-508.pdf)

And it gets *worse* at finer granularity: the three architectures with the most clusters (120–233) all
scored **under 40%**. Lutellier et al. later showed better input dependencies help but do not rescue it —
symbol dependencies improve accuracy by **7–12%** over include dependencies, and *"the overall accuracy is
low for all recovery techniques"*
([ICSE SEIP 2015](https://jgarcia.ics.uci.edu/wp-content/uploads/archdeps_icse_seip_2015.pdf)). Their
metric-instability finding matters for anyone building a scoreboard: *"MoJoFM would select a different best
technique in four out of five cases with different input dependencies."*

### Call graphs are a lower bound with a measured hole

The folklore is that reflection is the problem. Sui et al. measured otherwise: median recall 0.884, and
*"the main sources of unsoundness are **not** reflective method invocations, but objects allocated or accessed
via native methods, and invocations initiated by the JVM, without matching call sites"*
([ICSE 2020 abstract](https://2020.icse-conferences.org/details/icse-2020-papers/47/On-the-Recall-of-Static-Call-Graph-Construction-in-Practice) —
the full paper is 403 to automated fetch, **[unverified beyond the abstract]**).

Helm et al.'s ISSTA 2024 numbers are worse, and they separate *methods* from *edges* — which turns out to be
the distinction that matters. On Batik (179 kLOC):

| Algorithm | Precision (methods) | Precision (**edges**) | Recall (methods) | Recall (**edges**) |
|---|---|---|---|---|
| CHA (OPAL) | 7.3% | **0.9%** | 97.6% | 93.1% |
| RTA (OPAL) | 40.1% | 9.1% | 63.4% | 59.5% |
| 0-CFA (OPAL) | 44.6% | 21.6% | 62.3% | 58.2% |

> "**Precision and recall in terms of call edges are often significantly lower than in terms of reachable
> methods.**"
> — [Helm et al., ISSTA 2024](https://www.opal-project.de/articles/TotalRecall@ISSTA24.pdf)

The sharpest single result: Xerces is instantiated through a reflective factory, and *"none of the 0-CFA
implementations can resolve this reflection, **resulting in empty CGs**"* — recall **0.0**, a completely empty
call graph, from one reflective instantiation. That is #644's silent-failure rule in its most extreme form:
not a wrong graph, an empty one, indistinguishable from "nothing calls anything."

Python and JavaScript are no better. PyCG averages **99.2% precision / 69.9% recall** on five real packages
while passing 103/112 micro-benchmark tests — the ISSTA authors use exactly this gap as their example of
why micro-benchmarks mislead ([PyCG, ICSE 2021](https://arxiv.org/pdf/2103.00587)). For JavaScript, WALA's
ACG reaches ~0.35–0.71 *reachable-edge* recall, and the dominant root cause of missed edges is **dynamic
property access at 70%**, not `eval`
([Chakraborty et al., ECOOP 2022](https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.ECOOP.2022.3)).
Feldthaus et al. are refreshingly plain that this is by design — the analysis is *"in principle unsound"* —
and add the caveat every recall number in this section inherits: *"recall should be understood as an upper
bound… whereas precision is a lower bound"*
([ICSE 2013](https://www.franktip.org/pubs/icse2013approximate.pdf)).

### Layering is not in the graph

Import edges carry no direction of intent. The clearest primary evidence is ArchUnit's own documentation for
`DependencySettings`, which shows that even *given* the layers, the graph does not police itself:

> "All dependencies that either have an origin or a target outside any defined layer will be ignored… these
> dependency settings would e.g. **not detect an unwanted dependency `myapp.service.MyService →
> myapp.utils.SomeShadyUtils → myapp.controller.MyController` because `myapp.utils` is not part of any
> layer**."

That `ensureAllClassesAreContainedInArchitecture()` exists as an *opt-in* is the point: nothing in the import
graph reveals that a class belongs to no layer. And `freeze()` exists because *"When rules are introduced in
grown projects, there are often hundreds or even thousands of violations"*
([ArchUnit guide](https://www.archunit.org/userguide/html/000_Index.html)).

### Reflexion models: the one reconciliation mechanism that works

Murphy, Notkin & Sullivan's technique takes an **authored** high-level model, an **extracted** source model,
and a hand-written **map**, and computes three edge classes:

> "The solid lines show the **convergences**, where the source model agrees with the high-level model… The
> dashed arrows show the **divergences**, where the source model includes arcs not predicted by the high-level
> model… The dotted lines show the **absences**, where the source model does not include arcs predicted by the
> high-level model."
> — [FSE 1995](https://www.cs.ubc.ca/~murphy/papers/rm/reflexion_model_fse95.pdf)

The economics, from Table 1 and the Excel case study:

| System | SLOC | Source-model tuples | **Map lines** | HLM entities |
|---|---|---|---|---|
| NetBSD VM | 250,000 | 15,657 | **7** | 8 |
| Excel | 1,200,000 | 119,637 | 971 → 1,425 | 15 → 16 |

NetBSD: 250 kSLOC summarised by a **seven-line map**, and *"In a one hour session, the VM developer was able
to iteratively specify, compute and interpret several reflexion models."* Excel: a 10-year Microsoft veteran
*"specified and computed an initial reflexion model of Excel in a day and then spent four weeks iteratively
refining it. He estimated that gaining the same degree of familiarity… **might have taken up to two years**
with other available approaches"*
([IEEE Computer 1997](https://www.cs.ubc.ca/~murphy/papers/rm/rm-case-study.pdf)). The initial model had
*"15 convergences, 83 divergences, and four absences"* and summarised 61% of calls; the final one summarised
**99.7%**.

Two findings inside that study bear directly on the atlas. First, the view is not the deliverable: *"Simply
viewing a displayed reflexion model does not generally provide sufficiently detailed information for a user
to assess, plan, and perform a software engineering task."* Second, and more uncomfortable for anyone
building a diagram: *"**Surprisingly, the engineer drove almost all the investigation of the reflexion model
and the source code from textual information.** Thus, it might be important to rethink the general belief that
graphical interfaces to reverse- and reengineering tools are the best approach."*

And the one longitudinal follow-up found that detection does not cause repair: at IBM over two years,
*"**Most of the violations discovered remained until, and beyond, the final session.** Indeed, the violations
which were removed, were removed **as a side-effect of other actions**"*
([Rosik et al., PPIG 2009](https://ppig.org/files/2009-PPIG-21st-rosik.pdf)).

---

## 3. Behavioural views: the artifact scales worse than the system

### Sequence diagrams, and the trace they cannot hold

UML's own semantics for interactions is a *pair* of trace sets, and the spec states the partiality itself:

> "The semantics of an Interaction is given as a pair of sets of traces… valid traces and invalid traces. The
> union of these two sets need not necessarily cover the whole universe of traces. The traces that are not
> included are not described by this Interaction at all, and **we cannot know whether they are valid or
> invalid**." (§17.2.3.1)
> "Typically when interactions are produced by designers or by running systems, the case is that **the
> interactions do not tell the complete story**." (§17.1.1)
> — [UML 2.5.1 PDF](https://www.omg.org/spec/UML/2.5.1/PDF)

Data is excluded by the spec (*"the Interactions do not focus on the manipulation of data"*), there is no
global clock, and — the trap almost nobody computes — the metamodel default operator is `seq`, which is
*weak* sequencing, so vertical position on the page does **not** imply global order across lifelines. A
diagram with a `par` fragment denotes a combinatorial *set* of traces, not one.

Reverse-engineering from traces runs into arithmetic. Cornelissen & Moonen characterised seven real traces:

| Trace | # calls | # unique | repetitiveness | max depth |
|---|---|---|---|---|
| checkstyle-simple | 31,238 | 1,920 | 93.85% | 46 |
| pacman-death | 139,582 | **156** | 99.89% | 8 |
| checkstyle-3checks | 1,173,968 | 2,079 | 99.82% | **104** |
| azureus-newtorrent | 3,713,026 | 34,660 | 99.07% | **466** |
| ant-selfbuild | **12,135,031** | 1,404 | 99.99% | 53 |

> "This poses a serious problem not only for straightforward visualizations such as **UML sequence
> diagrams**, but also for more elaborate techniques as they typically do not scale up to traces of millions
> of events."
> — [TUD-SERG-2008-005](https://web.archive.org/web/2018/http://swerl.tudelft.nl/twiki/pub/Main/TechnicalReports/TUD-SERG-2008-005.pdf)

Best lossless reduction in the literature is ~3×–40×; applied to 12.1 M calls that is still 300 K–4 M items.
And Systä's is the underrated negative result: automatic abstraction **made comprehension worse**, because
auto-named `subsc_7.sc` boxes carry no meaning and cut at pattern-length rather than logical boundaries —
*"Renaming a subscenario box requires knowledge of its contents and thus needs to be done manually"*
([Systä dissertation](https://theswissbay.ch/pdf/Gentoomen%20Library/Computer%20Architecture/Reverse%20Engeniering/Static%20And%20Dynamic%20Reverse%20Engineering%20Techniques%20For%20Java%20Software%20Sysytems.pdf)).
**Compression a human cannot name is compression that does not aid comprehension.**

### Statecharts avoid one blow-up and inherit another

Harel's contribution is stated as an equation — *"statecharts = state-diagrams + depth + orthogonality +
broadcast-communication"* — against a specific arithmetic:

> "**Clearly, two components with one thousand states each would result in one million states in the
> product.** This, of course, is root of the exponential blow-up in the number of states, which occurs when
> classical finite-state automata or state diagrams are used, and orthogonality is our way of avoiding it."
> — [Harel 1987, p. 243](https://dubroy.com/refs/Statecharts_a_visual_formalism_for_complex_systems.pdf)

His own stated limits: contradictions are unpoliced (*"more subtle contradictions can occur as a result of
the 'deep' character of statecharts, and should be carefully avoided"*), and the area-dominated layout that
makes the view readable is the first thing to break — the "unclustering" escape hatch *"is a necessary option
when the system under description is large"* but *"undermin[es] our basic area-dominated graphical
philosophy."* No measured size ceiling exists for hand-authored statecharts; Harel's largest published
example is one wristwatch on one page.

Inferring them from traces has a measured ceiling, and it is low:

| Target model size | SMArTIC precision | recall |
|---|---|---|
| 10 nodes | 0.584 | 0.988 |
| 20 nodes | 0.185 | 0.998 |
| 30 nodes | 0.059 | 0.999 |
| 40 nodes | **0.014** | 1.000 |

Read plainly: past ~20 states, a trace-inferred machine accepts almost everything
([Lo & Khoo](https://dl.comp.nus.edu.sg/server/api/core/bitstreams/0b338a5d-7bd2-4c46-bcb4-aef0194d187d/content)).
Exact inference is NP-complete and non-approximable; the STAMINA winner needed 20 GB and a SAT solver to
clear 99%, where the prior state of the art scored **52%**
([Heule & Verwer](http://www.cs.ru.nl/~sicco/papers/ese12.pdf)). And Ammons is candid about the human in the
loop: *"Specification mining depends on a sizable training set of well-debugged traces… In order to learn
the rule, we needed to remove the buggy traces from the training set"* — which *"would require inspecting
each trace manually for bugs"*
([POPL 2002](https://static.aminer.org/pdf/PDF/000/545/960/mining_specifications.pdf)).

### Cyclomatic complexity: what McCabe actually wrote

Worth restating because it is routinely mis-cited. The limit of 10 is a departmental operating practice, and
the exemption is in the same paragraph:

> "The particular upper bound that has been used for cyclomatic complexity is 10 which seems like a
> reasonable, but **not magical**, upper limit… The only situation in which this limit has seemed unreasonable
> is when a large number of independent cases followed a selection function (a large case statement), which
> **was allowed**."
> — [McCabe, TSE 1976, p.314](http://www.literateprogramming.com/mccabe.pdf)

The paper's entire empirical base is **24 Fortran subroutines**, ten values listed, a *"close correlation"*
asserted with no coefficient — on a sample McCabe says in the same sentence was *"chosen because they were
troublesome."* He also concedes the view is blind to data (*"it is the data behavior that either precludes or
makes realizable the execution of any particular control path"*) and that v is a floor (*"v is only the
minimal number of independent paths that should be tested"*).

Shepperd's critique lands on collinearity: *"The most reasonable inference… is that there exists a
significant class of software for which v(G) is no more than a proxy for LOC"*, and *"the outperforming of
v(G) by a straightforward LOC metric in over a third of the studies considered"*
([SEJ 1988](https://www.cs.du.edu/~snarayan/sada/teaching/COMP3705/lecture/p1/cycl-1.pdf)). NIST's own
appendix contains a study that *derived* a threshold of **3**, not 10, and NIST supplies the best primary
evidence that threshold metrics get gamed rather than obeyed: a developer *"could take a module with
complexity 90 and reduce it to 'modified' complexity 10 simply by adding a ten-branch multiway decision
statement to it that did nothing"*
([NIST SP 500-235](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication500-235.pdf)).

### Traces answer what happened, and almost nothing else

Cornelissen et al.'s systematic survey selected **176 articles** from 4,795 and names four problems, all
verbatim: *incompleteness* (*"the same limitation applies to software testing"*), choosing *scenarios*,
*scalability*, and the *observer effect*. Its verdict on the field:

> "Execution trace analysis, and trace reduction in particular, has received substantial attention in the
> past decade. This has **seldomly resulted in industrial studies and never in controlled experiments**."

Only **6 of 114** summarized articles involved human subjects at all
([TSE 2009](https://web-backend.simula.no/sites/default/files/publications/Simula.SE.477.pdf)).

The coverage numbers are the ones to carry: one scenario touches *"31% of the system's packages; 16% of the
system's classes and **9% of the system's methods**"* for Checkstyle; 7% of methods for Weka
([Hamou-Lhadj & Lethbridge, ICECCS 2005](https://users.encs.concordia.ca/~abdelw/papers/ICECCS05-TraceCompexity.pdf)).
Zaidman's industrial case is the outer bound: one scenario, **~9.72×10⁸ events / 90 GB raw / 620 MB gzipped**,
1.5 h dilated to 7 h, analysis pipeline needing *"at least 29 hours"*
([PhD thesis](https://azaidman.github.io/publications/azaidmanPhD_A4.pdf)).

`gprof` is the cheap cousin and states its own three assumptions: sampling is *"inherently a statistical
approximation"*; *"we make the simplifying assumption that all calls to a specific routine require the same
amount of time to execute"*; and recursion defeats it outright — *"time is not propagated from one member of
a cycle to another"*, with the fix (collapsing cycles) destroying the very attribution the tool exists for
([gprof paper](https://docs-archive.freebsd.org/44doc/psd/18.gprof/paper.pdf)). Overhead is *"five to thirty
percent"* against 6–40× for full tracing — profiling is cheap precisely because it throws the trace away.

### BPMN: a 110-construct notation used 9 constructs at a time

zur Muehlen & Recker analysed **120 BPMN models** from three independent sources:

> "BPMN is used in groups of several, well-defined construct clusters, but **less than 20% of its vocabulary
> is regularly used** and some constructs did not occur in any of the models we analyzed. While the **average
> model contains just 9 different BPMN constructs**, models of this complexity have typically just 4-5
> constructs in common, which means that **only a small agreed subset of BPMN has emerged**."

Four constructs appear in more than half of diagrams: Sequence Flow, Task, End Event, Start Event. And the
finding usually lost in citation: *"a pair wise comparison of the 120 models revealed **only 6 pairs of
models that shared the same BPMN subset**"*, with average Hamming distance **7.5–8.8** constructs
([CAiSE 2008 reprint](https://link.springer.com/content/pdf/10.1007/978-3-642-36926-1_35.pdf)). Readers
re-learn the dialect per diagram.

The standards body ratified the finding: BPMN 2.0's **Descriptive** conformance sub-class is 24 rows, ~23
visible elements — roughly 20% of the full Process Modeling class — and the authors' own retrospective states
their paper *directly caused* those sub-classes
([BPMN 2.0 §2.1.1](https://www.omg.org/spec/BPMN/2.0/PDF)).

---

## 4. Data, interface and deployment: declaration versus truth

### ER diagrams show only what was declared

Chen's 1976 model defines entity, relationship, role, attribute-as-function, and four levels of view of
data. Two of his own statements matter here. First, the entity/relationship split is a **human choice**, not
a property of the world: *"It is possible that some people may view something (e.g. marriage) as an entity
while other people may view it as a relationship."* Second, the model is scoped to what an enterprise chose
to record: *"A complete description of an entity or relationship may not be recorded in the database of an
enterprise."*

Extraction is genuinely Read-tier — `pg_dump --schema-only`, `information_schema.table_constraints`,
SQLite's `sqlite_schema` — but with two failure modes worth naming. `information_schema.table_constraints`
*"contains all constraints belonging to tables that the current user owns or has some privilege other than
SELECT on"*, so **an under-privileged extraction silently returns a smaller graph, not an error**
([PostgreSQL docs](https://www.postgresql.org/docs/current/infoschema-table-constraints.html)). And SQLite
ships enforcement off: *"Foreign key constraints are disabled by default (for backwards compatibility)"*
([sqlite.org/foreignkeys](https://www.sqlite.org/foreignkeys.html)) — so teams routinely omit the
declarations, and an application-enforced join appears in `information_schema.columns` and nowhere else. The
ER view derived purely from the catalog shows two disconnected islands.

ORM schemas are the alternative source, and the three major ones disagree about their own authority. Django:
*"A model is the single, definitive source of information about your data."* Rails: *"Your database remains
the source of truth"*, with `db/schema.rb` a generated snapshot that *"cannot express everything your database
may support such as triggers, sequences, stored procedures."* **Which artifact you extract from changes what
the view can contain.**

### GraphQL introspection is the only surface that cannot drift

Every other API view is a *description* that may or may not match the server. OAS says so structurally —
its value proposition is understanding a service *"without requiring access to source code, additional
documentation, or inspection of network traffic"*
([OAS 3.1](https://spec.openapis.org/oas/v3.1.0.html)) — and the OAI's own learning site states the
open-world reading: *"OpenAPI lists operations that you can do, but it does not assert anything regarding
operations not in the OAD"* ([learn.openapis.org](https://learn.openapis.org/introduction.html)). Absence
from the description is not evidence of absence from the server.

GraphQL introspection is different in kind: the result is produced by the running server from the same
schema it executes against, so it *is* the implementation's account of itself, and deprecation is part of
the surface (`isDeprecated`, `deprecationReason`) rather than an annotation bolted on
([graphql-spec §4](https://raw.githubusercontent.com/graphql/graphql-spec/main/spec/Section%204%20--%20Introspection.md)).
gRPC reflection has the same property but *"is not automatically enabled"* and is commonly disabled in
production for exactly the security reason that makes it useful
([grpc.io](https://grpc.io/docs/guides/reflection/)).

### Topology views are desired state

Kubernetes supplies the vocabulary for the whole category: an object carries a `spec` (*"desired
characteristics"*) and a `status` (*"the current state… supplied and updated by the Kubernetes system"*)
([K8s objects](https://kubernetes.io/docs/concepts/overview/working-with-objects/)). **A manifest in git is
`spec` only; `kubectl get -o json` returns both.** Kubernetes is the only one of the three modern forms that
hands you `status` from the same command. `terraform graph` describes *"only the dependency ordering of the
resources… **in the configuration**"*, and Terraform's answer to reality is a separate operation —
`plan -refresh-only` exists to reconcile *"changes made to remote objects **outside of Terraform**"*
([terraform graph](https://developer.hashicorp.com/terraform/cli/commands/graph),
[plan](https://developer.hashicorp.com/terraform/cli/commands/plan)).

### The runtime service map is sampled four times over

Dapper's numbers are the empirical case that a telemetry-derived map is never complete. Sampling was
**necessary**, not incidental — full sampling cost **16.3%** latency:

| Sampling frequency | Avg latency change |
|---|---|
| 1/1 | 16.3% |
| 1/16 | 2.12% |
| 1/1024 | −0.20% |

Production ran at *"one sampled trace for every 1024 candidates"*, and *"often as low as **0.01%** for
high-traffic services"*, with a **second** round of sampling at collection
([Dapper](https://static.googleusercontent.com/media/research.google.com/en//archive/papers/dapper-2010-1.pdf)).
OpenTelemetry reproduces the doctrine — *"a sampling rate of 1% or lower"* — and its service graph connector
adds a fourth filter: spans are paired *"until its corresponding pair span is received or the maximum
waiting time has passed"* (default 2 s), and *"if spans of a trace are spread out over multiple instances,
spans are not paired up reliably"*
([OTel sampling](https://opentelemetry.io/docs/concepts/sampling/),
[service graph connector](https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/main/connector/servicegraphconnector/README.md)).

**An edge appears only if both endpoints were instrumented, the trace survived every sampling stage, and both
spans landed at the same collector in time. Absence of an edge is never evidence of absence of the call.**
Google's defence is a frequency argument — *"if a notable execution pattern surfaces once in such systems, it
will surface thousands of times"* — which is sound for hot paths and worthless for a failover path, a monthly
batch job, or an admin endpoint.

### Context maps are the one view with no extraction path at all

Evans' Context Map answers "what is our relationship to the team on the other side of this boundary?" and its
edges are labelled Partnership, Shared Kernel, Customer/Supplier, Conformist, Anticorruption Layer,
Open-host Service, Published Language, Separate Ways, Big Ball of Mud. The reason none of that is derivable
is stated in the pattern itself:

> "Even when boundaries are clear, relationships with other contexts place constraints on the nature of model
> or pace of change that is feasible. **These constraints manifest themselves primarily through non-technical
> channels** that are sometimes hard to relate to the design decisions they are affecting."

And the boundaries themselves may simply not exist: *"**Well-defined context boundaries only emerge as a
result of intellectual choices and social forces**… When these factors are absent, or disappear, multiple
conceptual systems and mix together, making definitions and rules ambiguous or contradictory"*
([DDD Reference](https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf)).
Bounded Context does give one partially checkable hook — *"physical manifestations such as code bases and
database schemas"* — so module and repo boundaries are *evidence about* contexts. The edge labels are not
observable in any artifact.

---

## 5. Metric and spatial views: position has to be invented

### Treemaps, and the number nobody quotes

Shneiderman's own history page carries the most useful figure in this cluster, and it is a *human* limit, not
a pixel one:

> "We were impressed to examine thousands of nodes at 5-7 levels at once on the screen, but **novices did
> better seeing 20-50 nodes at 1-3 levels**."
> — [treemap history](https://www.cs.umd.edu/hcil/treemap-history/)

Treemaps are also documented — by the squarified-treemap authors — to show *hierarchy* badly: *"The worst
case is a balanced tree, where each parent has the same number of children and each leaf has the same size.
**The treemap degenerates here into a regular grid**"*, and squarification makes it worse: *"the hierarchical
structure is far less obvious than with the standard treemap algorithm"*
([Bruls, Huizing & van Wijk](https://vanwijk.win.tue.nl/stm.pdf)).

Barlow & Neville tested it against node-link and it lost: *"RT for the treemap was always slower than RT for
at least one of the other plots… **Twelve of the participants ranked the treemap last** among the four
plots"*, and it was **dropped from Experiment 2 entirely**. Their diagnosis is structural: *"Treemaps nest
child nodes inside parent nodes with an offset… **This offset means that the area of a rectangle is not
proportional to the size of the node**… Nodes of the same size can be represented by different size
rectangles if their depth in the hierarchy differs"*
([InfoVis 2001](https://courses.ischool.berkeley.edu/i247/s02/readings/barlow.pdf)).

### Code cities are treemaps, and their evidence is better than the field's

Wettel & Lanza state both facts themselves. On layout: *"**We implemented a modified treemap algorithm.**"
On the deeper problem, which is the honest frame for every spatial view of code:

> "The layout of a real city is constrained by its physical evolution, i.e., the locations of the buildings
> have an inherent meaning… **in a software city there is no notion of 'appropriate location' of a building,
> since software does not have a tangible physical presence.**"
> — [VISSOFT 2007](https://wettel.github.io/download/Wettel07b-vissoft.pdf)

Their ICSE 2011 experiment is a genuine outlier in a weak field: 41 participants (21 academic, 20 industry),
four locations, three countries, blinded grading, against Eclipse+Excel as baseline. Result: **+24.26%
correctness** (p = .001) and **−12.01% time** (p = .043), with the correctness gain *larger* on the larger
system (+29.62% on 454 kLOC Azureus).

But the loss pattern is the part worth carrying, and the authors state it:

> "As expected, **at focused tasks (e.g., A4.1, B1.1) CodeCity did not perform better than the baseline,
> because Excel is very efficient in finding precise answers** (e.g., the largest, the top N)… At tasks that
> benefit from an overview… CodeCity constantly outperformed the baseline."

On A1 (naming convention) CodeCity *underperformed* on the large system. On B1.1 *"none of them is good
enough to solve this problem alone."* And the experimenter effect is declared: *"One of the experimenters is
also the author of the approach and of the tool"*
([ICSE 2011](https://wettel.github.io/download/Wettel11a-icse.pdf)).

The base rate against which to read that: **62% (113/181)** of SOFTVIS/VISSOFT approaches *"either do not
include any evaluation, or include a weak evaluation"*, and only **7% (12)** ran a case study with industry
practitioners on real systems
([Merino et al., JSS 2018](https://homepages.ecs.vuw.ac.nz/~craig/publications/jss2018-merino.pdf)).

### Change history beats product metrics — twice, independently

This is the empirical licence for hotspot maps, and it is a licence for *change* as the signal, not
complexity.

Graves et al., on a 1.5 MLOC telephone switching subsystem, 80 modules, ~130,000 changes: *"**the number of
times code has been changed is a better indication than its length**"*, and *"nearly all of the complexity
measures were virtually perfectly predictable from lines of code"* — LOC correlates **.97** with McCabe
V(G), **.99** with total operands
([TSE 2000 / NISS TR80](https://www.niss.org/sites/default/files/technicalreports/tr80.pdf)). Their best
model is a recency-weighted decay, the direct ancestor of every "recent churn" hotspot — *"a change which is
a year older than another change of the same size is only half as influential."*

Nagappan & Ball, on 44.97 MLOC of Windows Server 2003 across 2,465 binaries: **absolute** churn gives
R² = **0.052**; **relative** churn gives R² = **0.811**, and discriminant analysis separates fault-prone
binaries at **89.0%**
([ICSE 2005](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/icse05churn.pdf)). The
ratios are the finding; raw churn is nearly worthless.

CodeScene's operational definition — *"a hotspot is complicated code that you have to work with often"*,
using LOC as the complexity proxy and change frequency as the effort proxy — is that literature turned into
a product, with its own documented caveats: the indentation-complexity metric has *"sensitivity to layout
changes"*, and temporal coupling flags *"a unit test tends to change together with the code under test"*,
which is not a defect
([CodeScene docs](https://docs.enterprise.codescene.io/versions/3.4.0/guides/technical/hotspots.html)).

### Change coupling is a ranked hint, never an assertion

ROSE's numbers, over 100,000+ transactions in eight open-source projects: fine granularity averages
**feedback 0.66, recall 0.33, precision 0.29**, with topmost-three likelihood **0.70**. The authors state
the user cost plainly: *"The programmer has to check about three suggestions in order to find a correct
one"*
([TSE 2005](https://thomas-zimmermann.com/publications/files/zimmermann-tse-2005.pdf)). Two of their threats
matter for any product built on this: transactions are *inferred* (*"at most 200 seconds apart"*), and
*"**We have made no attempt to assess the quality of transactions** — ROSE learned from past transactions,
regardless of whether they may be desired or not."* It learns bad practice as readily as good.

### Ownership: two studies, opposite polarity, reconciled by granularity

Bird et al., on Windows Vista and 7: the number of **minor contributors** (< 5% of commits to a binary)
correlated with failures at ρ = **0.86–0.93** pre-release — *"higher… than any other metric that Microsoft
collects"* — and lifted adjusted R² from 26% to 46%
([FSE 2011](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/bird2011dtm.pdf)).

Rahman & Devanbu, at *line* granularity on four C projects with matched controls, found the opposite sign:
*"**Implicated code is less likely to involve contributions from multiple developers**"*, which they read as
support for Linus' Law. They name the conflict themselves and locate it in granularity: *"these 2 results
were both based on **aggregated studies at the module and file levels, whereas ours is a fine-grained study
at the line level**"*
([ICSE 2011](http://macbeth.cs.ucdavis.edu/icse2011.pdf)).

And Graves et al. found *neither*: *"**We saw no evidence of a 'too many cooks' effect**: the number of
developers who had changed a module did not help predicting numbers of faults"* — at 80-module granularity.
Three studies, three answers, and the granularity is the variable. They agree on one thing only:
concentrated, file-specific experience associates with better outcomes.

CODEOWNERS is the declared alternative and measures nothing. Its documented semantics are all fail-open:
*"the **last** matching pattern takes the most precedence"*; *"If any line in your CODEOWNERS file contains
invalid syntax, **that line will be skipped**"*; and a file over **3 MB** *"will not be loaded, which means
that code owner information is not shown"*
([GitHub docs](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)).
A typo removes an owner rather than raising an error.

### What developers actually asked for, in 2007

Cherubini et al. — 8 interviews plus two surveys, **427 responses** at Microsoft — found most drawings
*"had a transient nature"* and that *"**Visualizations from reverse-engineering tools were also transient**…
discarded immediately after the desired information was acquired."* Their design implication is the brief
this whole survey is answering:

> "**A visualization that was spatially stable, yet up-to-date with the evolution of the code, could help a
> developer stay oriented**… If the visualization were shared among the development team then ad-hoc
> meetings, design reviews, and especially onboarding could benefit from the common ground that it would
> create."

Two more findings from the same paper, both uncomfortable for automated views: *"**No current view conveys
both levels of abstraction simultaneously**"*, and *"when diagrams were generated automatically, they seemed
to be regarded as **less interesting** than diagrams that were produced manually in a collaborative
effort… automatically-produced visualizations do not require developers to externalize their mental models"*
([CHI 2007](https://files.software-carpentry.org/training-course/2012/08/cherubini-venolia-whiteboard-2007.pdf)).
Cheapness of generation is not adoption.

---

## 6. Narrative views: the only ones that carry *why*

### ADR sets, measured

Nygard's original post is itself written as an ADR, and its rationale is a decay argument: *"**Large
documents are never kept up to date.** Small, modular documents have at least a chance at being updated"*
([cognitect.com, 2011](https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions)). The
five fields are Title / Context / Decision / Status / Consequences, with the constraint that *"The language
in this section is value-neutral"* (Context) and *"**All consequences should be listed here, not just the
'positive' ones**"*.

The only large mining study: **921 repositories, 6,362 ADR files**
([Buchgeher et al., IEEE Access 2023](https://doi.org/10.1109/ACCESS.2023.3287654)).

| ADRs in repo | Repositories |
|---|---|
| 1–5 | **554** |
| 6–10 | 198 |
| 11–20 | 122 |
| 21–30 | 27 |
| >30 | 20 |

*"about 50% of all repositories with ADRs contain just one to five ADRs suggesting that the concept has been
tried but not yet definitively adopted."* In **278 repositories, every ADR file was edited on a single day
and never touched again**. Nygard's template dominates at **723 of 921** repos, MADR at 129.

The crucial distinction for staleness: *"Most ADR files (3255) are created and only committed initially.
After that they are never modified again"* — and that is **by design**, because *"ADRs are intended to be
collected following an append-only approach, where new decisions are added and obsolete decisions are marked
with a superseded status."* **For an ADR set, staleness does not mean entries went wrong; it means the log
stopped growing.**

### Every mechanised narrative view fixes the pointer, none fixes the prose

CodeTour states the trade-off in its own schema. You anchor a step by `line` (ordinal) or by `pattern` — *"a
regular expression… allows you to associate steps with line content as opposed to ordinal"* — and you pin the
tour to a git ref, where `Current Commit` means *"the tour is restricted to the current commit, and
therefore, **will never get out of sync**"* at the cost of replaying against a frozen tree
([microsoft/codetour](https://github.com/microsoft/codetour)). **You can have a tour that never goes stale or
a tour that describes the current code, not both.**

Swimm attacks the same problem from the other end — tracking the referent through git history with a weighted
signal histogram, and escalating rather than guessing: *"**We'd rather ask you to reselect a snippet than
offer a strange suggestion**"*, and *"Did the code vanish entirely? If so, it took its secrets with it,
because we can't document a negative"*
([Swimm engineering blog](https://swimm.io/blog/how-does-swimm-s-auto-sync-feature-work)). Note the
operational constraint, which is exactly #644's shallow-clone guard: *"we need to be able to analyze the full
history."*

**Neither claims to keep the prose correct. Nothing in either system detects a description that has become
semantically wrong while still pointing at code that exists.**

### Documentation is an onboarding view, and its self-reported use is inflated 2×

Lethbridge et al.'s numbers are the load-bearing ones. 68% agreed documentation *"is always outdated"*, and
**81%** agreed it *"can be useful, even though it might not always be the most up-to-date."* Effectiveness by
task: **61%** for *learning* a system, **32%** for *working with an established* one. And trust tracks
abstraction — perceived-accuracy↔consultation correlations run 0.67 (testing docs), 0.58 (low-level design),
0.41 (architecture), **0.03 (specifications, n.s.)** — *"the closer you get to the real code, the more
accurate the documentation must be for SEs to use it."*

Then the methodological warning that should discipline every survey-based claim in this area:

> "6 percent of the respondents said they spent considerable time reading documentation… In our observational
> studies at the same company, however, **SEs consulted the documentation only 3 percent of the time: 12 times
> over 357 logged events.**"
> — [IEEE Software 2003](https://courses.cs.duke.edu/fall11/cps196.1/classwork/Lethbridge-Singer-Forward-2003.pdf)

Aghajani et al. built their entire ICSE 2019 method around that objection, mining **805,939 candidate
artifacts** down to 878 manually analysed, and produced a **162-type taxonomy**. Note the ordering of their
top category: **Completeness 268 > Up-to-dateness 190 > Correctness 72**. Incompleteness outweighs
staleness, and both dwarf outright wrongness
([ICSE 2019](https://www.inf.usi.ch/faculty/lanza/PUBS/P/Agha2019a.pdf)).

READMEs are measured too: over 4,226 sections in 393 repos, *"How"* is **58.4%** of sections and appears in
88.5% of files, *"What"* appears in **97%** of files — but *"Why"* is **2.7%** of sections and only 25.7% of
files ([Prana et al., EMSE 2019](https://arxiv.org/pdf/1802.06997)). The README answers *what* once and
*how* endlessly, and almost never answers *why*. Robillard's API study finds the same hole from the other
side: **Resources** was the #1 obstacle (50 of 74 respondents), and within it, 8 respondents named missing
*"documentation on the high-level aspects of the API such as **design or rationale**"*
([IEEE Software 2009](https://www.cs.mcgill.ca/~martin/papers/software2009a.pdf)).

### The transfer mechanism that works is a person

Dagenais et al. followed **18 newcomers across 18 projects** at IBM for a year:

> "Four of the orientation aids mentioned by newcomers seemed to be crucial to their integration: previous
> experience, examples, **mentor** and **questions to colleagues**."
> "**tools that help with exploration of the project landscape can complement, but should not replace, human
> guides.**"

Two supporting findings bear on the atlas directly. Newcomers cannot judge staleness — *"Determining if a
document was outdated was challenging for newcomers, because **they knew little about the past and current
states of the project**"* — and the version history served as the rationale source, failing exactly when
*"the descriptions of bugs and fixes were trivial (e.g., 'Bug Fixed')"*
([ICSE 2010](https://www.cs.mcgill.ca/~martin/papers/icse2010.pdf)).

Begel & Simon add the asymmetry that explains why written views exist at all despite losing on speed.
Subject V: *"**You can figure out something in five minutes by asking someone instead of spending a day of
looking through code and design docs.**"* But: *"**Asking questions, however, reveals to your co-workers and
managers that you are not knowledgeable**, an exposure that most new developers felt might cause their
manager to reevaluate why they were hired"*
([ICER 2008](https://andrewbegel.com/papers/icer-begel-2008.pdf)). The fastest channel is the one newcomers
are most inhibited from using.

---

## How the views connect

This is what #646 needs. Three distinct relationships, and they demand different things of the atlas.

### A. Same graph, different resolution — a zoom, not a new node kind

These are genuine resolutions of one containment hierarchy. An element at one level is *composed of*
elements at the next, and the relation is total and machine-computable.

- **C4 Context → Container → Component → Code.** Stated as containment: *"A software system is made up of one
  or more containers…, each of which contains one or more components, which in turn are implemented by one or
  more code elements"* ([c4model.com/abstractions](https://c4model.com/abstractions)). Structurizr encodes
  exactly this as `softwareSystem > container > component` and derives every view from it.
- **Module → package → file.** The filesystem hierarchy, Read tier, free.
- **Treemap → code city.** Not analogous — *identical*. A code city is a treemap with a third dimension
  extruded, by the authors' own statement, and inherits every treemap pathology.
- **Trace → summarised sequence diagram → interaction overview.** Successive lossy compressions of one event
  sequence.

For this class, **one node kind rendered at several depths is correct**, and a level is a rendering
parameter, not a new entity.

### B. Genuinely different projections — different node kinds, many-to-many

These are not resolutions of each other. They partition the same code along **orthogonal axes**, and the
mapping between them is many-to-many in both directions.

**Module ⊥ concern.** The best-measured pair. Across five systems, *"86% of the concerns we analyzed were
crosscutting, **concerns were implemented by 6 classes on average, and classes implement 10 concerns on
average**"* ([Eaddy dissertation](http://www.cs.columbia.edu/~eaddy/Dissertation.pdf)). One ArgoUML
bug-level concern spanned *"41 fragments, totaling three fields, 33 methods, and 26 classes… scattered in
**16 different packages**"* ([Robillard & Murphy TOSEM 2007](https://www.cs.mcgill.ca/~martin/papers/tosem2007.pdf)).
Changing *"the conditions under which logging occurs"* in Tomcat would *"require the developer to consider
**47 of the 148 (32%)** Java source files."* In Goblin, **95% of requirements were scattered across multiple
classes and 100% across multiple methods.**

Robillard & Murphy give the same result on a system small enough to hold in your head. In JHotDraw 5.3
(~16 kLOC), the conceptually trivial task "add a file format to the save feature":

> "Conceptually, the SAVE FEATURE concern is trivial. However, its implementation is not: **The code
> implementing SAVE FEATURE is scattered throughout at least 35 classes**, and interacts as well as
> intersects with other concerns."

decomposing into sub-concerns of 15 methods across 6 classes (COMMAND), 15 across 4 (STORAGE MANAGEMENT),
and *"about 39 methods scattered in 31 different classes"* (WRITING)
([TOSEM 2007](https://www.cs.mcgill.ca/~martin/papers/tosem2007.pdf)). The worst single case in Eaddy's
data is Rhino's ECMAScript clause *"10.1.4 – Scope Chain and Identifier Resolution"*, smeared across **68 of
138 classes** and carrying **73 bugs** ([TSE 2008](http://www.cs.columbia.edu/~eaddy/publications/tse.online.pdf)).

**Module ⊥ runtime.** The SEI states it as a rule and gives the counterexample:

> "A module refers first and foremost to a **unit of implementation**… A component refers to a **runtime
> entity**… **Who cares?** If every module turned into exactly one component at runtime, it would be easy to
> sweep the difference under the rug. But this is often **far from reality**!"
> "This system has **eleven components but only two modules**… Failing to distinguish between modules and
> components makes it too easy to blithely assume that every unit of implementation turns into exactly one
> unit of execution. **It isn't so.**"
> — [Clements et al., *Documenting Software Architectures*, Prologue](https://ptgmedia.pearsoncmg.com/images/9780321552686/samplepages/0321552687.pdf)

Their three viewtypes — **module**, **component-and-connector**, **allocation** — are declared
non-interchangeable, and even in the 1:1 case *"the module and component are **different elements sharing the
same name**. Don't be tempted."*

The SEI's earlier technical note puts the general principle better than anything else in the survey, and it
is the sentence to hand #646:

> "There is no single rendition of a building architecture. Instead, there are room layouts, elevations,
> electrical diagrams, plumbing diagrams… **Which of these views is the architecture? None of them. Which
> views convey the architecture? All of them.**"
> "**'accidental' hybrids, views that unintentionally conflate unrelated information, can be one of the
> greatest sources of architectural confusion.**"
> — [CMU/SEI-2001-TN-010](https://www.sei.cmu.edu/documents/1972/2001_004_001_13811.pdf)

The same note declines to prescribe a view set for the same reason Kruchten and C4 do: *"they are not useful
for every system, and do not constitute a closed set… **This is fundamentally why we do not advocate a
particular view or collection of views.**"*

**Structure ⊥ history.** Hotspot, churn, coupling and ownership maps are computed over commits, not over
code, and Gall's whole point was that they surface *"hidden dependencies not evident in the source code."*
A change-coupling edge and an import edge are different relations that happen to share endpoints.

**Declaration ⊥ measurement.** CODEOWNERS vs. measured authorship; an OpenAPI document vs. what the server
serves; a Terraform config vs. `plan -refresh-only`; an ADR's stated decision vs. the code. Each pair is two
views of "the same thing" that can diverge arbitrarily, and **in no case does the tooling detect the
divergence.**

For this class, **one graph rendered several ways is wrong.** These need distinct node kinds with explicit
cross-kind edges — which is precisely 42010's `correspondence`, SysML's allocation table, and the reflexion
model's map, arrived at three times independently.

### C. Known conflicts, and what is known about reconciling them

| Pair | How they conflict | Best measured reconciliation |
|---|---|---|
| Authored architecture ↔ package structure | **59–92%** of ground-truth components are not a package or directory | none automatic; ICSE 2013's answer was ~100 person-hours per system plus architect certification |
| Authored architecture ↔ clustered recovery | best avg **MoJoFM 58.76%**, c2c majority match "under 20%" | *"likely to require extensive manual intervention"* |
| Authored model ↔ extracted source model | divergences and absences | **reflexion models** — the only technique with three named edge classes; Excel: 1 day + 4 weeks, map 170 → 1,425 entries |
| Diagram ↔ diagram (UML) | no global well-formedness predicate over a *set* of diagrams; boundaries *"not strictly enforced"*; structure↔behaviour agreement is *"the responsibility of the modeler"* and a conforming tool *"is not required"* to help | **Egyed**: 24 rule types, 34 models to 162,237 elements, **1.4 ms average / 0.2 ms median** per change. But **only 5 of the 24 rules are cross-diagram**; 17 are per-metaclass rules the spec already gives you |
| View ↔ view (any framework) | 42010 requires you to *record* known inconsistencies, not resolve them | Structurizr's single-model-many-views removes the class of error entirely, by making views non-artifacts |
| Import graph ↔ call graph | neither is a subset of the other — imports over-report unused includes and under-report computed dispatch; call graphs miss reflection, native and JVM-initiated calls | none; both are lower bounds on different relations |
| Static call graph ↔ dynamic call graph | 0-CFA edge recall **30–58%**; one reflective factory → **empty graph** | traces, at Runtime tier and 9% method coverage per scenario |
| Hotspot ↔ ownership ↔ coupling as *fault* signals | Bird: minor contributors ρ = .86–.93 (binary level). Rahman: implicated code has **fewer** authors (line level). Graves: **no** "too many cooks" effect, and co-change a **poor** fault predictor (80-module level) | **granularity is the variable, and it must be declared.** Zimmermann's coupling is useful for *navigation* at file/entity level and not claimed for fault prediction |
| Documented ↔ implemented | at IBM over two years, *"most of the violations discovered remained until, and beyond, the final session"* | detection ≠ repair; this is the one result that should temper any "we'll surface drift" claim |

### D. The one number that unifies the section

Every comprehensible structural view is a **100–600× compression** of the artifact it describes, and every
primary source agrees the compression function is **supplied by a human**:

- Chromium: **18,698 files / 1,183,799 include dependencies** → a human ground-truth architecture of **67
  clusters**.
- Excel: **1.2 MSLOC / 119,637 source-model tuples** → a reflexion model of **16 entities**.
- NetBSD VM: **250 kSLOC** → **8 entities**, via a **seven-line map**.
- Node-link readability: matrices beat node-link on 6 of 7 tasks *"when graphs are bigger than twenty
  vertices"*, the only node-link win being path-finding
  ([Ghoniem, Fekete & Castagliola, InfoVis 2004](http://iihm.imag.fr/blanch/teaching/infovis/readings/2004-Ghoniem-GraphReadability.pdf)).
  Yoghourdjian et al.'s survey of 152 studies: **80% use ≤100 nodes**, and past 200 nodes **70% of studies
  stop showing the whole graph**, with the honest caveat that the round numbers everyone quotes *"were not
  identified by empirical research"*
  ([Visual Informatics 2018](https://arxiv.org/abs/1809.00270)).

The map, the `definedBy` predicates, the layer regexes, the DSM's hierarchy — **all authored**. The best
measured price for authoring it is Excel's: one day to a first model, four weeks of refinement, 1,425 map
entries. The best measured price for *not* authoring it and inferring instead: ~100 person-hours per system
to establish ground truth, and recovery techniques that land at MoJoFM 31–59.

---

## Measured on this repo

Claims about behaviour, settled by execution rather than reading. All at `ff9cd21`, first-party
non-test sources only (**484 files / 34,138 lines**) unless stated.

**The import graph is degenerate, because Swift has no file-level import.** Every one of the 484 files
declares module-level imports only. First-party edges, in full:

| Edge | Count |
|---|---|
| `import ArgoEngine` | 124 |
| `import ArgoUI` | 7 |
| `import ArgoTerminal` | 1 |

**The whole 34,138-line application has a first-party import graph of 4 nodes and 3 edges.** At the file
level it does not exist. This is the resolution problem in miniature: the same code yields a 4-node module
map, a **605**-node type diagram (distinct declared `struct`/`class`/`enum`/`protocol`/`actor` names), and a
**910+**-node call graph (declared `func`s). Three views, three orders of magnitude, one artifact.

**The directory tree is an uneven component map.** Level-1 directories per module:

| ArgoEngine (16 groups) | files | ArgoUI (3 groups) | files |
|---|---|---|---|
| Hub | 25 | **Shell** | **247** |
| Transcript / Drive | 18 / 18 | Specimen | 35 |
| Account / Session / Companion | 17 / 15 / 15 | VisualContract | 29 |
| Spawn / Discovery / Binding | 11 / 10 / 9 | | |
| Project / Repository / Handoff | 7 / 6 / 6 | | |
| Health / Annotation / Storage / Launch | 5 / 3 / 1 / 1 | | |

The engine's directories read as a domain model; the UI's do not — one directory holds 51% of the module, and
you must descend to level 2 (`Deck` 165, `Connect` 24, `Toolbar` 15, `Sidebar` 10) before the tree says
anything. **A component map cut at a fixed depth is wrong for at least one of these two modules.** This is
Garcia et al.'s 59–92% finding reproduced at small scale: directories are evidence about components, not
components.

**The module view and the domain view are different projections here, and the gap is measurable.** The
domain concept **Session** — an L2 entity with its own `docs/domain/l2-session.md` — appears in:

| | |
|---|---|
| Files mentioning `Session` | **203 of 484 (42%)** |
| Directory groups spanned | **13 of 20** |
| Files in the directory named `Session` | **10** |
| Localisation rate | **4.9%** |

Same shape for other terms: `Permission` 31 files / 7 groups / **0** in a directory of that name; `Binding`
52 / 6 / 7; `Plan` 16 / 7 / 2; `Mode` 8 / 3 / 0. Eaddy's ratio — 6 classes per concern, 10 concerns per
class — is the same phenomenon; here it runs to 203 files for one concept. **An atlas that renders the
directory tree has not rendered the domain model, and no amount of zooming turns one into the other.**

**The hotspot map is empty, and the ownership map is a constant.** 394 commits, 30 merges, squash-merged:

- Maximum churn on any Swift file: **5 commits**. Top ten range 3–5. Nagappan & Ball's relative-churn
  measures are undefined at this resolution, and #644's warning stands — in a squash-merge repo, co-change
  measures **PR scope**, not design coupling.
- Authorship: **598 of 615 commits (97.2%)** from one identity, plus 9 from the same human under a second
  email, 5 from `github-actions[bot]`, 3 from `Claude`. Bird's MINOR/MAJOR/OWNERSHIP metrics have no
  variance to explain.

**A treemap would be near-uniform.** File sizes: n = 484, mean 70.5, median 57, p90 132, p99 233, **max 281**,
min 5 lines. Largest tile is **4.9× the median**. Treemaps were built for distributions spanning *"five or
six orders of magnitude"* (Shneiderman's own framing, disk usage); this one spans 1.7. There is no mass to
find.

**This repo's actual comprehension views are all Author tier.** Across 66 tracked docs and 118 Markdown files
there are **zero mermaid blocks** — not one diagram of any kind. What exists instead:

- A **domain glossary**: 69 bolded definitions across 14 files under `docs/domain/`, ~6,584 words, indexed by
  `CONTEXT.md`. Swift comments cite it by section (`CONTEXT.md L1 · Binding`).
- An **ADR set**: 22 records, 1,439 lines, numbered 0001–0026. That puts this repo in the **11–20 band that
  only 122 of 921 repositories reach**, and above it. But the set is not clean: **four numbers are missing**
  (0002, 0004, 0005, 0006), and ADR-0022 records that 0002 was *"since deleted"* — contradicting Nygard's
  *"Numbers will not be reused… we will keep the old one around, but mark it as superseded."* Three ADRs
  (0001, 0003, 0007) carry no `Status` line at all, one is still `proposed` (0024), and **six of the
  nineteen with a status** are marked superseded, partially superseded, or amended. Reading the set without
  following status gives wrong answers.
- An **executable layering rule**: `scripts/swift-boundaries.sh`, whose own header states the reflexion
  premise exactly — *"each is checkable by looking at imports and declarations alone — which is the whole
  reason they are gates rather than review notes"*, enforcing that exactly one file
  (`CockpitPresentation+Hub.swift`) may read live Hub state. This is a three-edge reflexion model that runs
  in CI, and it is the only view here that cannot silently go stale.
- A **cyclomatic complexity gate** at **15** (`apps/macOS/.swiftlint.yml`), between McCabe's *"reasonable, but
  not magical"* 10 and NIST's *"limits as high as 15 have been used successfully."*

---

## What could not be verified

- **ISO/IEC/IEEE 42010 Clause 5.7 and Annex A.6 verbatim.** ISO's catalogue pages return 403; the publisher
  preview truncates at Clause 4.2.7. All correspondence-requirement wording is quoted from the standard's
  editor's own companion site and AD template, which project 5.7 rather than reproduce it. **[unverified]**
- **Dobing & Parsons, CACM 2006.** ACM DL returned 403. Its numbers here are Petre's verbatim quotation of
  it. A 171-vs-182 respondent discrepancy between sources is unresolved. **[unverified]**
- **Petre, SoSyM 2014** ("'No shit' or 'Oh, shit!'") — paywalled, abstract only. **[unverified]**
- **Murphy/Notkin/Sullivan TSE 2001** — closed access, no author copy survives. All reflexion figures are
  cited to FSE 1995 and *IEEE Computer* 1997 instead. **[unverified for the TSE extension]**
- **Sui et al., ICSE 2020** — ACM PDF 403. The median-recall 0.884 figure and the native-methods finding are
  quoted from the authors' abstract only. **[unverified beyond the abstract]**
- **Reiss & Renieris, ICSE 2001** — no open copy located anywhere. The famous "1 GB per 2 seconds of C/C++"
  figure is reported second-hand via Cornelissen et al. and is **not** treated as fact; the companion *Generating
  Java Trace Data* was verified directly instead (1.68 GB from ~25 s, 6–40× dilation). **[unverified]**
- **Walkinshaw & Bogdanov ASE 2008; Lorenzoli et al. GK-tail ICSE 2008; STAMINA competition report EMSE
  2013** — all unreachable. **No numbers are reported from any of them**; the STAMINA figures come from the
  winning entrant's own open paper. **[unverified]**
- **Behnamghader et al. EMSE 2017 and Brunet et al. WCRE 2012** on architecture erosion rates — paywalled,
  no OA copy. The "more than 3,000 violations" figure is not used. **[unverified]**
- **Garcia et al.'s widely-quoted "107 hours over seven systems"** — the ICSE 2013 paper itself reports four
  systems at ~100 recoverer-hours. The seven-system figure could not be traced to its source. **[unverified]**
- **The "70–90% of nonconformances are documentation flaws" figure** that circulates in the conformance
  literature could not be traced to any primary source and is **not used**.
- **Wilde & Scully 1995; Eisenbarth/Koschke/Simon TSE 2003; Shepperd & Ince JSS 1994; Baker WCRE 1995;
  Sensalire et al. VISSOFT 2009** — abstracts only. **[unverified]**
- **"Immersion vs. familiarity" (EMSE 2026)**, the executed VR code-city replication — paywalled behind
  Springer SSO. Index summaries claim VR participants took *more* time, which **contradicts** the 2021/2022
  result of large significant time savings. Not reported as settled. **[unverified]**
- **ER diagram size limits** — no official DB-tool documentation states one. pgAdmin documents no threshold;
  MySQL Workbench pages 404. The circulating "~100–150 tables" figure appears only in vendor blogs.
  **[unverified]**
- **Swift's `swift-api-digester`** has no official documentation page; the source repo and its tests are the
  only primary reference. **[unverified]**
- **Structurizr DSL repo** now 404s to fetch (archived Jan 2024); the DSL reference is quoted from
  docs.structurizr.com. The archival date is from search metadata. **[unverified]**
- The **BPMN construct total (~110)** is derived from the spec's own statement that Analytic is *"about half
  of the constructs in the full Process Modeling Conformance Class"*, not stated as a number anywhere.
  **[partially unverified]**
- Two claims that **do not exist** despite being widely attributed: UML 2.5.1 contains **no** sentence
  "there is no notion of diagram interchange completeness" (zero hits over the full extracted text), and
  Eaddy's studies **do not include Apache Ant** (zero occurrences across four documents). Robillard &
  Murphy's five studies are AVID, Jex, **Redback**, jEdit, ArgoUML — "Redwood" and "Sextant" appear nowhere.

---

## Suggestions going forward

1. **Fix the tier vocabulary before the node ticket lands.** #644's Read/Parse/Resolve/LLM does not span the
   view space. **Author** (a human wrote it; no extractor produces it) and **Runtime** (needs the system
   running and instrumented) are both necessary, both populated, and both consequential — Runtime is the only
   tier that answers "what actually calls what," and Argo cannot reach it from a clone.

2. **Split the atlas's node kinds along relationship class B, not along view names.** Views that are the same
   containment hierarchy at different depths (C4's four levels, module→package→file, treemap→city) are a
   **rendering parameter**. Views that are orthogonal projections (module ⊥ concern, module ⊥ runtime,
   structure ⊥ history, declaration ⊥ measurement) need **distinct node kinds plus explicit cross-kind
   edges**. Three independent traditions converged on that edge — 42010's `correspondence`, SysML's
   allocation table, the reflexion model's map — which is about as strong a signal as this literature offers.

3. **Do not ship a directory-derived component map as "the architecture."** It is wrong 59–92% of the time
   against architect-certified ground truth, and this repo reproduces the failure: 51% of `ArgoUI` sits under
   one directory, while the concept `Session` spans 13 of 20 directory groups with a 4.9% localisation rate.
   Render it as *"the directory tree"* — a true, cheap, Read-tier fact — and let the domain view be its own
   projection with its own edges.

4. **Reflexion is the reconciliation primitive worth stealing.** Three edge classes — **convergence,
   divergence, absence** — over an authored model and an extracted one. It is the only mechanism in the
   survey that both scales (7-line map over 250 kSLOC) and states its own uncertainty. `swift-boundaries.sh`
   is already a three-edge reflexion model running in CI; generalising that shape is a smaller step than it
   looks. Two cautions from the record: the engineer in the Excel study *"drove almost all the investigation
   … from textual information"*, and at IBM over two years **detection did not cause repair**.

5. **Carry granularity as a first-class property of every history-derived claim.** Ownership, coupling and
   churn give *contradictory* answers at line, file, module and binary granularity — Bird, Rahman and Graves
   are all correct and all disagree. A node that says "diffusely owned" without saying at what granularity,
   over what window, with what identity-merging, is not a fact. On this repo the honest rendering is that
   both maps are **degenerate**: max churn 5 commits, 97.2% single-author.

6. **Budget for 100–600× compression, and accept that a human or an LLM supplies it.** Every readable
   structural view in the survey compresses by that factor, node-link readability tops out around 20–200
   nodes, and no automated technique clears MoJoFM 59%. This repo needs the same: 484 files → 20 directory
   groups → 4 modules, and the interesting grouping (`Session`, `Permission`, `Binding`) matches none of
   those three cuts. **That compression function is the atlas's actual product.**

7. **Take the honesty tier straight from this survey's failure modes.** Absence of an edge is never evidence
   of absence: not on a static call graph (one reflective factory ⇒ **empty**), not on a sampled service map
   (Dapper at 1/1024, filtered four times), not on a catalog-derived ER diagram (an under-privileged read
   returns a smaller graph, not an error), not in CODEOWNERS (a syntax error silently drops a line, a 3 MB
   file silently drops everything). Every one of these is #644's degrade-down rule with a different mask on.
