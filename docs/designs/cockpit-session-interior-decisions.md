# Session-interior decisions (#186)

Running log for the section-by-section grill over `cockpit-session-interior-prototype.html`.
Format per entry: **Decision** / **Why** / **HTML change**. Folded into the #186 resolution
comment + one map gist at close, then this file goes.

Sections: A Brow (locked) · B Roster rail · C1 Header · C2 Tabs · C3a Activity · C3b Delivery ·
C3c Preview · C4 Terminal dock · D Concierge (locked, out of scope) · cross-states.

---

## Cross-surface conventions (HOIST TO THE MAP #157, not just #186)

These emerged while grilling the session interior but are **not** session-specific — they govern every
surface. At #186 close, gist each of these onto the map's Decisions-so-far (flagged cross-surface) so
the next surface grill inherits them, and keep the detail in the ticket sections below.

- **C2.2 — Two tabs `Activity · Delivery`** (Outcomes cut). Reverses C2.1.
- **C3b.2 — Delivery = Hybrid review surface** (Overview · Code Review · Files); review-is-the-bottleneck,
  raw diff is the fallback; one surface across the pre-PR / PR boundary; lifecycle ribbon = state readout
  (not nav); findings reconcile (no pile-up); inline comments → Address-with-agent. Prototype:
  `docs/designs/cockpit-delivery-review-prototype.html`.
- **C3b.3 — Git control = review actions, not a git GUI** (mechanical ops = cockpit; semantic = agent; no
  user-facing staging index; terminal = escape hatch).
- **Artifact = render toggle in Files** (committed file, `diff | rendered` lens; no Outcomes storage). Part of C2.2.
- **C3b.6 — Continuous-scroll master–detail** (GitHub "Files changed" feel): left list = nav/TOC only; right
  detail = one continuous scrollable feed of all items concatenated (title headers); scroll flows item→next,
  scroll-spy highlights the current item, click jumps, real builds virtualise. Governs EVERY master/detail
  surface — Activity Timeline + Delivery Overview/Code Review/Files. Prototype: `cockpit-session-interior-prototype.html`.
- **C3b.7 — One control line** (Delivery): tabs + CI pipeline rail + CTA on a single line; status baked into
  the tabs (blocking = red badge on Code Review; `Files (N)` count), no free-text status string; multi-Delivery
  glance banner cut (reverses C3b.4's glance). The pipeline-rail visual kept.

---

## Section B — Roster rail

### B1 — Signal hierarchy: attention dominant (brightness), liveness always legible
- **Decision:** Three tiers of glance signal on the rail:
  1. **Needs-you / attention** is the dominant signal, expressed as **brightness** — a needs-you row is the brightest plane in the rail and beats selection for the eye (Penumbra law: attention = brightness).
  2. **Liveness (running vs idle)** must stay clearly visible underneath attention, carried by the state dot — running = live green glow dot, idle = dim grey dot. Never collapsed into "calm."
  3. **External** rows are ghosted (dimmest).
- **Why:** With 3–4 sessions, running is the *normal* state, not actionable — what changes behaviour is a session that needs you. But the user still scans running-vs-idle constantly, so liveness can't disappear; it drops to the second tier via the dot rather than the plane brightness.
- **SUPERSEDED by B4** on the *how*: no plane brightness lift, no coloured words. The dot alone carries all state (see B4). The intent (attention must be findable) stands; the mechanism is dot-colour only.

### B2 — Row content: `dot · name · word` / `model · branch`; no ctx in the rail
- **Decision:** Row line 1 = state dot · name · state word. Line 2 = model · branch (external rows show their path in place of a branch). The **ctx % bar is removed from the rail** — context is per-session detail carried by the header, which always shows it.
- **Why:** dot+word+name is the glance; model+branch is cheap disambiguation. ctx% is something you act on once focused, never compare across the rail, and it only rendered on the already-selected row anyway.
- **HTML change:** Removed the `.ctxline` block from `railHTML()`. Header ctx arc unchanged.

### B3 — State word = single headline status, priority-ordered; failure is tier-1
- **Decision:** The rail word is the session's one headline status, chosen by priority; the dot colour encodes the tier:
  1. **Attention · needs input (gold):** `NEEDS YOU`, `BLOCKED`
  2. **Attention · failure (red):** `FAILED`, `CI FAILED`, `ERRORED` — demands you like needs-input, but red = "something broke", not "needs a decision". Also a brightest-plane tier-1 row (red-tinted lift).
  3. **Delivery milestone** (if notable, none of the above): `CI RUNNING`, `PR OPEN`, `MERGED`
  4. **Liveness:** `RUNNING`, `IDLE`
  5. **Kind:** `READ-ONLY` (external)
- **Why:** One row shows one word, so it must always be the most decision-relevant thing. Failure is a "come here" signal, not a calm delivery state, so it rises to tier 1 — but distinguished from needs-input by hue (red vs gold) so you know *which kind* of attention it wants.
- **HTML change:** Added a demo failed row ("Migrate config loader · CI FAILED", block/red dot). The word-priority ordering stands; the *colour treatment* is per B4 (dot only). Failed = red dot.

### B4 — The dot is the only state colour; planes and words stay neutral
- **Decision:** State is carried **entirely by the dot's colour** — running green · idle grey · needs-you gold · failed/blocked red · external hollow. Planes do **not** glow or tint by state (only the *selected* plane brightens, as selection feedback), and the state word stays neutral dim text. No double-encoding, no coloured words, no per-state plane lifts.
- **Why:** The rail was too colourful — plane glow + coloured word + coloured dot all said the same thing three times. The dot is a small, quiet, unambiguous carrier; one channel is enough. Keeps the rail calm (aligns with the "quiet status, dial glow down" direction) while attention stays findable via a gold/red dot. Reserves brightness for selection alone.
- **Ordering (folded in):** stable, most-recent-activity first; attention is *not* surfaced by reordering (no jump-to-top churn) — the dot does it. Long-roster pin-to-top can be revisited if lists ever overflow.
- **HTML change:** Removed `.plane.attn` / `.plane.fail` CSS and the `attn`/`fail` word classes; `railHTML` plane = `active`/`recede` only, word = neutral. Dots keep their colour classes.

### B5 — `+ New session` pinned to the rail top; `⚙ Archived` at the foot
- **Decision:** A quiet, persistent `+ New session` (⌘N) row pinned at the **top** of the rail, above the roster. Dim, not a loud CTA. Opens the spawn flow (cwd · worktree · mode defaults — that flow is a later question). `⚙ Archived (n)` stays pinned at the rail **foot** (from #161). The rail is bookended: make-more at top, look-back at bottom.
- **Why:** Starting work is a top-level action and the rail is the session list's home; top is where the eye starts and where "add" conventionally lives. Kept quiet so it never competes with attention dots.
- **HTML change:** Added `#newses` row as first rail child + CSS. `#arch` unchanged.
- **Note:** the "spawn flow (cwd · worktree · mode defaults)" phrasing is **superseded** — spawn is zero-config (`+ New session` opens a session, not a config surface; see #186 spawn-UX resolution / PR #187).

### B6 — Roster zero-state (cold-start / empty cockpit) = just `+ New session`
- **Decision:** When there are no sessions at all, the roster shows **only the `+ New session` button** — nothing else. No hero, no illustration, no orb foregrounding, no Next-up card, no onboarding copy. The empty rail with the pinned `+ New session` (B5) IS the zero-state.
- **Why:** Cold-start is a one-time, transient state; anything fancy is chrome you see once and never again. The single obvious action carries it. Keeps the surface honest and quiet.
- **HTML:** rail renders with an empty roster + the existing `#newses` row; no dedicated zero-state scene needed beyond that.

---

## Section C1 — Session card header

### C1.1 — Title is a stable fallback chain, never the live task
- **Decision:** The header title resolves through a fallback chain and stays stable (does not rewrite per turn):
  1. **Explicit name** — set via the CLI / by the user → wins.
  2. **Linked ticket** — if the session links to a ticket, title = the ticket's name.
  3. **Conversation-derived** — otherwise an inferred label from what the session is doing.
  The rail shows the *same* resolved title, so rail ↔ header always match. The live task lives in the Activity now-head, not the title.
- **Why:** The header is the session's fixed frame; a title that rewrites every turn breaks rail↔header correspondence and is disorienting. A fallback chain gives a stable, meaningful name whether or not the user named it or linked a ticket.
- **Open knock-on:** when the title is ticket-derived, the `intent #<n> ↗` chip partly duplicates it — resolved in C1.2 (meta row).
- **HTML change:** `H_RUN.title` → `'Auth refactor'` (conversation-derived example); removed `taskTitle:true` (drops the running caret). `H_IDLE`/`H_EXT` already identity-based.

### C1.2 — Meta row = one fixed spec line; intent chip never repeats the title
- **Decision:** Meta row order = `status · model · mode · branch(+∆/↑) · elapsed · intent-link`. ctx stays as the arc top-right (glance ring, honours "ctx always in header"). The **intent chip** is the navigable ticket link and never echoes the title: when the title is ticket-derived (`titleSrc==='ticket'`) it collapses to `#<n> ↗`; otherwise it shows `intent #<n> <name> ↗`.
- **Why:** Order reads state → identity → delivery → time → link — the natural triage sweep. De-duping the chip against the title kills the redundancy flagged in C1.1 without losing the jump-to-ticket affordance.
- **HTML change:** Conditional in `header()` on `o.titleSrc`. Visually unchanged for the current scenes (H_RUN is `derived` → full chip); the compact form appears only for ticket-titled sessions.

### C1.4 — Header is a single ring-left / tabs-right band that absorbs the tab row (LOCKED shape)
- **Decision:** The header is one horizontal band, no separate tab strip beneath it:
  - **Left:** a large **ctx ring** (~56px) whose arc = derived ctx, centre = `~38%` with `ctx` label below (honest tilde; external → empty ring + `unknown`), then the **title** over a one-line **meta** (`Mode · elapsed · git ∆/↑ · intent ↗`). Live dot only when running.
  - **Right:** the three tabs `Activity · Delivery · Outcomes` with count badges + active underline, **bottom-aligned** to the band edge so they sit close to the tab content below. `setTab()` still drives them.
  - Rejected: the four stacked-header variants (H1–H4) and the pill/glyph/elapsed-core ring treatments — chosen = plain text tabs + %-in-ring. No action buttons / `⋯` menu.
- **Why:** Folding the tabs into the header collapses two bands into one (the real space win). A large ring makes ctx glanceable; putting the % (not elapsed) in its centre keeps the ring honestly about context. Bottom-aligned tabs read as attached to their content.
- **HTML:** `header()` renders `headTabs()` on the band's right (standalone `tabs()` removed from every scene); `h1()` ring centre `~n%` / sub `ctx`; `.htabs{align-self:flex-end}`. `?header=` switcher retained for reference; default = take 1.

## Section C2 — Tabs / panel model

### C2.1 — Three tabs: `Activity · Delivery · Outcomes`; Preview & Files leave the card
- **Decision:** The session card has exactly three tabs. The Dock (terminal) stays docked beneath all of them, not a tab.
  - **Activity** — the runtime tree: Agent/Turn/Tool Call/Plan/Subagent blueprint/Compaction/Usage. The live "what is it doing" view.
  - **Delivery** — the branch-keyed Delivery: lifecycle strip (commits·pr·ci·review·merge), **Diff** (file changes), **Review + Finding** (verdicts), **Check** (CI), Gate. *Review verdicts and file changes live here* (L4 domain).
  - **Outcomes** — the session's `produces` ledger (persisted, session-keyed, tier-badged). Typed rows: **artifact** (path-addressed file/doc — *opens here*, its only home), **code** (→ deep-links to Delivery), **ticket** (→ deep-links to the provider). External sessions have **no Outcomes** (honest empty state — no plugin to emit, not back-derived).
- **Removed from the card:** **Preview** is a cockpit-level singleton (ADR-0011 / CONTEXT) → project/cockpit-level surface, not a session tab. **Files** (explorer/editor/scratch terminal) are Workspace/project-scoped → not the card. **Concierge** is global + deferred (ADR-0007) → out of scope.
- **Why:** Each tab renders a distinct domain cluster with no overlap. Outcomes earns its own tab because `Outcome` is persisted + session-keyed and outlives both the live Activity timeline and the branch-keyed Delivery — and it's the only home artifacts have.
- **HTML change:** `tabs()` renders activity/delivery/outcomes; added `outcomesBody()`; removed `previewBody()` + the `preview` scene; updated `ORDER`/`NAMES`/`setTab`.

### C2.2 — Outcomes is CUT as a session tab → two tabs `Activity · Delivery` (REVERSES C2.1's third tab)
- **Decision:** The session card has **two** tabs, not three. Outcomes is removed. Rationale: once everything is committed (repo = SoT), Outcomes held no truth of its own — all three of its types re-home:
  - **code / PR** → already the whole **Delivery** tab (a "code outcome" row was just a pointer to it). Redundant.
  - **artifact** → a committed file, so it already lives in **Delivery / Files** as a diff. It gains a **`diff | rendered` toggle** in the file header (view the report as a doc / diagram as a diagram, not just its diff). No separate storage, no separate tab.
  - **ticket raised** → belongs to the **Work / ticket side** (which owns tickets) + the session's `intent ↗` header link. Not session-local.
- **The one thing given up:** the single persisted *"this session ultimately produced X, Y, Z"* aggregation. Judged not worth a live tab — it re-homes as an **end-of-life "produced: #418 ↗ · report.md" recap** on an ended/archived session (and/or header meta), not a pane you watch while working.
- **Why:** A fat Delivery next to a one-row Outcomes was imbalanced because it *was* redundant. Cutting it removes an empty tab and distributes the two real jobs (render an artifact, point at a raised ticket) onto surfaces that already exist. Consistent with "Argo owns only the glue."
- **HTML:** delivery-review prototype header tabs → `Activity · Delivery` (Outcomes dropped); Files file-header gains a `diff | rendered` toggle for artifact/doc files. `outcomesBody()` in the session-interior prototype is retired.

## Section C3b — Delivery panel

### C3b.1 — Delivery uses nested sub-tabs (Files · Checks · Review) under a persistent lifecycle spine + gate; Files is a GitHub-style diff
- **Decision:** Delivery does NOT cram everything into one column — it nests:
  - **Persistent sub-header:** the compact **lifecycle spine** (`commits · pr · ci · review · merge`, branch-keyed, dots+connectors) and the **merge Gate** line (`blocked · <reasons>`) — always visible across sub-tabs.
  - **Sub-tabs:** `Files · Checks · Review` (count/verdict badges). Each heavy concern gets its own full canvas — the only thing that scales to a 2,000-line diff without crushing the rest. (Two tab levels: session tabs → Delivery sub-tabs; accepted cost.)
  - **Files** (default) = **GitHub-style diff**: sticky left **file tree** (filter box, folders, per-file ∆ counts, comment badges) + **scrollable right diff** (old/new line-number gutters, red/green hunks, hunk headers). **Review findings anchor inline** on the exact diff line they're about.
  - **Checks** = CI list → a check's log. **Review** = verdicts + findings, each jumps to its diff line.
- **Why:** The diff alone wants the whole canvas; checks/review/lifecycle are different content, not details of the diff — so master-detail-in-one-column fails on volume. Sub-tabs give each its space; the diff mirrors GitHub (a known, high-density pattern) so it's instantly legible. Findings inline keep the verdict next to the code it judges.
- **HTML:** `deliveryBody()` = `.dspine` (lcstrip + dgate) + `.dsubtabs` + `.dbody`; `filesView()`/`checksView()`/`reviewView()`; `setDsub()` swaps. `.dfiles` = sticky `.ftree` | scrollable `.fdiff`; `.drow.add/.del` + `.hunk` + inline `.dfind`.

### C3b.2 — Delivery = a Hybrid review surface (Overview · Code Review · Files), one object across the pre-PR / PR boundary (SUPERSEDES C3b.1 sub-tab set + gate banner)
Explored in a dedicated throwaway prototype: **`docs/designs/cockpit-delivery-review-prototype.html`** (variants `?variant=A..E`, `?phase=local|open`). Grounded in a live research sweep of Cursor/Windsurf/Zed/Codex/Aider/Graphite/CodeRabbit. Four candidate surfaces (A Brief-first · B Cohort stack · C Turn timeline · D Findings inbox) were built and **C was cut** (too complex); **E Hybrid won**.
- **Thesis (from research):** *review is the new bottleneck* — as agents write more code, invest in review throughput, and **raw file-diff is the FALLBACK, never the primary read**.
- **One surface, two phases.** Delivery is the *same* pane before and after the PR; a `?phase` decides which. **Pre-PR (local, GitHub is blind):** findings run on the uncommitted tree, ribbon shows `commits` live + `not pushed`, frontier button = **Push & open PR**. **PR-open:** ribbon shows `commits✓ pr✓ ci◐ …`, frontier = **Merge** (gated). Moving between them is not two tabs — it's the ribbon + frontier reshaping.
- **Lifecycle ribbon = state readout, NOT nav and NOT a diff.** Thin line: `commits · pr · ci · review · merge` (done/live/wait dots) + a one-line state string. It never holds the diff or the navigation (that was the C3b.1 failure — the spine trying to be a router).
- **Three tabs:** **Overview** · **Code Review** · **Files**.
  - **Overview** = the digestible PR description (`WHAT / WHY`) *then* a **"WHAT THIS PR DID" table** of narrated changes (row = what it did · where · ∆ · a `●` flag if that change carries a finding; rows expand to their hunk). This *is* the PR body on push. Risk meter lives here (top-right). The old always-visible orientation band was **removed** (it duplicated Overview).
  - **Code Review** = the **Findings** inbox: severity-ranked (`blocking`/`advisory`), confidence-scored, evidence inline, CTAs cut to **Apply fix · Dismiss**. A **review-status row** (`reviewed 2m ago · commit a1b2c3 · claude code-review`) + **↻ Re-run review**.
  - **Files** = the **GitHub-style** sticky-tree + gutter diff (the C3b.1 diff, kept). Full-height. Per-file **Viewed** + `n/11 viewed` counter. **Findings anchor inline** on the exact line.
- **Findings reconcile, they do not pile up.** A finding is a stateful object (`open → addressing → fixed`, per L4 domain). Re-run reconciles against the *current* diff: still-present → stays, fixed → drops into a collapsed **"✓ N fixed since the last review"** group, new → tagged `new`. The list converges.
- **Inline comments are the iteration primitive.** Hover any diff line → `＋` to comment; human comment threads coexist with agent findings on the same line. Pending comments batch to **Address with agent →** (sends them to the agent to fix) or **Submit review** (GitHub-style batch).
- **Gate chip removed.** `merge · ask` chips were noise; the Gate policy still exists in the domain model but isn't drawn per-frontier.
- **Why:** Overview→Review→Files = orient → review → raw evidence, mirroring GitHub's own Conversation/Files split but leading with intent + risk so a huge agent diff is legible. The single surface across the push boundary answers "review happens *before* the PR (your gate) *and* after (CI + human), same findings object" — the de-dup unification.
- **Open (deferred):** the Overview tab **name** (built as "Overview"; alts *Walkthrough*/*Recap*); keep-or-cut the conditional **sequence-diagram** note on Overview.

### C3b.3 — Working-tree / git control = review actions, not a git GUI; mechanical ops the cockpit runs, semantic changes the agent runs
- **Decision:** Argo is **not a git client**. The operations you'd reach SourceTree/`git reset` for are re-expressed as review actions:
  - discard file/hunk → **Reject / Undo**; unstage → **exclude from PR** (there is **no user-facing staging index**); revert the attempt → **Rewind** (checkpoint); "do it differently" → **comment → Address with agent**; amend → edit the AI-drafted commit message; cancel everything → **Abandon delivery** (drop the branch).
  - **The split:** *mechanical, deterministic* git ops (discard, unstage/exclude, revert-file, commit, push, create-PR, merge) → **the cockpit runs them directly** (gated by Gate policy) — never routed through the LLM. *Semantic* changes (new judgement/code) → **the agent**. So you never ask the agent to run `git restore`, and you never hand-run plumbing either — the cockpit does it *as a consequence of a review decision*.
  - **Escape hatch:** genuine surgery (split a commit, interactive rebase, recover a deleted file) drops to the **terminal dock** (already present). Argo never builds a SourceTree and never becomes a dead end.
- **Why:** Keeps one mental model — you direct at the review level, execution is deterministic-mechanical (cockpit) or semantic (agent). Hiding the staging index matches Cursor/GitHub-PR convention; the terminal covers the 5% power-git that a review UI shouldn't model.
- **HTML:** conceptual (no staging UI added). Reject/Undo/exclude/Rewind/Abandon are the surfaced affordances; raw-git = terminal.

### C3b.4 — Delivery is ONE object, work-item-anchored; multi-Delivery = active full + rest collapsed glance
Resolves the #186 Delivery edge-case thread (teammate-PR-no-session · second-lifecycle-strip glance · Work-side vs Session-side).
- **Decision (anchoring):** A Delivery is **one object, anchored to the work-item**. The Session-side view (the Delivery tab) is a **deep-link/embed of that same surface**, not a second rendering — one component, two entry points (Work room canonical · Session room embedded).
  - **Teammate's PR with no local session** renders **Work-side only**; it has **no Session-side row** — an honest gap, not a stub. (So it produces no session-interior state; it's a Work-room concern.)
  - **Work-side vs Session-side** is therefore not two framings — it's the same hybrid Delivery surface (C3b.2: Overview · Code Review · Files) reached from either room.
- **Decision (multi-Delivery):** ~~active Delivery full + additional Deliveries collapse to a one-line "Also in this session · N more" glance strip.~~ **REVERSED (this session) — see C3b.7.** The glance banner is **cut** (user: "definitely remove this banner"; it was one strip too many). **Multi-Delivery rendering is DEFERRED**; v1 shows the single active Delivery. The **anchoring** decision above (one object, work-item-anchored, teammate-PR-no-session = Work-side only) **still stands**.
- **Why:** Anchoring to the work-item is the de-dup: the same PR seen from a session and from its ticket must be one truth, so the Session tab embeds rather than re-renders. A teammate's PR having no session row is the correct honest degradation (no local Agent/Run to show). Primary-full/rest-glance keeps one Delivery legible at full density while extra PRs stay a quiet glance — the Penumbra "one bright thing" law applied to Deliveries.
- **HTML:** anchoring stands; the glance render is cut (C3b.7).

### C3b.5 — Delivery uses the SAME master–detail shape as Activity (list-left nav / detail-right, GitHub-style review) — REFINES C3b.2's rendering
The Hybrid content of C3b.2 (Overview · Code Review · Files, review-is-the-bottleneck, pre-PR↔PR-open, findings reconcile, Address-with-agent) all **stands**. What changes is the *layout*: Delivery is rendered as the **same two-pane master–detail as the Activity tab** — a scannable **list on the left = pure navigation**, the **detail on the right = GitHub-style review**. The three sub-tabs (Overview · Code Review · Files) select **what the left list holds**; the right pane shows the selected item's detail. This kills the earlier "stack of strips" rendering (separate ribbon row + sub-tab strip + files-toolbar + frontier strip) the user rejected as far too dense. Prototype: `docs/designs/cockpit-session-interior-prototype.html`.

### C3b.6 — Continuous-scroll master–detail (CROSS-SURFACE) — the interaction model for every list/detail surface
The master/detail panes behave like **GitHub's "Files changed"**: the **left list is a table-of-contents / navigation only**; the **right detail is ONE continuous scrollable feed** of all the list's items concatenated, each with a title header. **Scrolling the detail flows item → next item → next** (no clicking) to the bottom of the list; a **scroll-spy** moves the left highlight to whatever section is in view; **clicking a list item smooth-jumps** to its section. Real builds **virtualise** the stream (content gets long). Applies to **every** master/detail surface — **Activity → Timeline** and **Delivery → Overview / Code Review / Files** — so the whole cockpit shares one navigation feel. **HOIST TO THE MAP** (cross-surface). Prototype: `cockpit-session-interior-prototype.html`.

### C3b.7 — One control line: tabs + CI pipeline rail + CTA; status baked into the tabs; glance cut
The Delivery pipeline ribbon, the sub-tab strip, and the primary action collapse into **one horizontal line**: `[Overview · Code Review · Files]` tabs (left) · the `commits — pr — ci — review — merge` **CI rail** (state readout, current node live) · the single **CTA** (`Push & open PR` pre-PR / gated `Merge` PR-open) (right). **No free-text status string.** The old trailing `#418 · CI running · review pending · 1 blocking · +2,755 −58 · 11 files` is **re-homed**: "CI running"/"review pending" are implicit in the rail's live/wait nodes; **"1 blocking" = a red badge on the Code Review tab**; **file count = `Files (N)`** on the Files tab; diffstat + `#418` dropped from the line. The **multi-Delivery glance banner is removed** (reverses C3b.4's glance). **Why:** the user's core complaint was "far too many strips and horizontal lines and layers" — this removes two whole bands and every restated fact, leaving header · one control line · two-pane · dock. *(The pipeline rail visual itself was explicitly liked and kept — only its redundant trailing text went.)* Prototype: `cockpit-session-interior-prototype.html`. **Status: settled by the user this session and FOLDED into `cockpit-session-interior-prototype.html` (the throwaway fanout alts a–f removed). Visual polish is deferred to Phase 2 foundations — these are prototypes, not designs.**

## Section C3a — Activity panel

### C3a.1 — Activity is two-pane master–detail; fanouts are collapsible grouped nodes in the timeline (SUPERSEDES both the right-rail and the fleet-section models)
- **Decision:** Activity is a **master–detail** layout, not a single column and not a rail.
  - **now-head moves to the dock header row** — the live "what's it doing + plan N/M" is live-process state, so it lives *in* the terminal dock's header row (not a separate strip, not a separate line — saves space), visible across tabs (the dock is docked under all of them). Activity is then *purely* the two panes. Dock header = `>_` terminal icon (left) · now-head · a bare chevron (right, expand/collapse). No Stop button, no `pty · claude · zsh` src text (Stop = Ctrl-C into the PTY per C1.3), and the redundant current-op peek line is removed (the now-head already names the step; raw ops live in the expanded PTY body).
  - **Left pane** holds TWO distinct sections, never merged: a **Subagents** section (its own collapsible group, label `Subagents`, with the group name — e.g. `Verify` — shown only when the subagents have one) that expands to a **dense row list** (row = dot · name · target · status, scales to ~30), and below it the **Timeline** step list (the to-do list of steps). Subagents are NOT interleaved into the timeline steps, and "fanout" is not surfaced as a term — it's just the Subagents group. No cards (a card grid dies at 30 wide).
  - **Right pane = detail** of the current selection: a tool step → its events/output/diff; a **subagent row click → that agent's live feed** on the right (its running tool stream). Always populated (a live session always has a selection) → no empty gutter. Both sections' rows are selectable and drive the one detail pane.
  - **Section headers are consistent:** the Subagents header uses the *same* treatment as the Timeline header (`SUBAGENTS · Verify · 3 running` mirrors `TIMELINE · newest first · past folded`) — two distinct sections, one header style.
- **Why:** Four alternatives were ruled out in sequence. A **right rail** is empty most of the time (dead space). A full-width **fleet section** of cards doesn't scale — 30 cards is absurd. **Inline** events bury the timeline and can't be watched at a glance. **Single-column** wastes width on wide screens (bare gutter or stretched prose). Master–detail earns the width honestly: the list stays narrow and scannable, the detail pane fills the rest with real live content, and grouped-expand fanouts scale to any N while staying in context. Outcomes stays out (its own tab, C2.1).
- **Open (deferred):** whether the fleet keeps running visibly when you switch to Delivery/Outcomes tabs (agents don't stop) — a possible always-docked live indicator; left for the dock/cross-tab pass.
- **HTML change (pending — applied once the concurrent header agent releases the file):** `activityBody()` → two-pane grid (`.acol` = list col + detail col); left = timeline rows with a collapsible `.fanout` grouped node expanding to a dense `.salist` (rows, not cards); right = `.tldetail` showing the selected step's events; now-head strip spans both.

### C1.3 — Header has NO actions at all
- **Decision:** The header carries no action buttons and no `⋯` menu. It is glance-only: title · spec line · ctx arc, plus the inline `intent ↗` / branch links. Every action that a menu might have held is either not a header concern or not a thing:
  - **Rename** → done in the terminal (or by editing the linked ticket); not a header control.
  - **Open in editor** → that's the file-editor surface (#183), reached as its own tab/surface, not a header action.
  - **Relaunch** → not a concept.
  - **Archive** → **automatic**, a status transition (session ends/merges/orphans → it moves to Archived); never a manual action.
  - **Link/unlink intent** → the inline `+ link intent` / `intent ↗` affordance already in the meta row.
- **Steering clarification (drives C4):** there is **no separate steer widget**. The dock is a live claude-code / codex **PTY**; you steer by typing at its prompt like any terminal. "Stop" = Ctrl-C into the PTY. The header owns none of this.
- **Why:** Frequent interaction is terminal typing; the "rare actions" either live on their proper surface or don't exist. A menu was speculative chrome.
- **HTML change:** Removed the `.hmenu` element and CSS (reverted to `ctxArc` only).
