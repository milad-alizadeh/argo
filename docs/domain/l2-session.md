## L2 · Session

- **Session** — one vendor conversation, keyed by **Harness + native Session ID** (ADR-0047). A
  Claude Session and a Codex Session never merge, even if their titles or Project match. A fork is
  a separate Session with its own native ID.

  A Session has one current posture: **`managed | watched`**. `managed` means Argo owns its live
  channel and can drive it through the Harness adapter. `watched` means Argo owns no live channel;
  the Session is readable but not drivable. A live channel is not durable across an Argo restart,
  so every surviving Session starts watched and can become managed through native resume.

  Vendor history is the source of Feed truth for both postures. Managed vendor events add immediate
  updates. For watched Sessions, a filesystem watcher can signal that history changed, but the
  adapter reads the change through the vendor interface. A transcript or rollout file is never an
  Argo domain object or input.

  Origin does not gate resume (ADR-0040). A SQLite lease stops two Argo windows from managing the
  same `(Harness, native Session ID)`. The lease does not prove that an external client is absent,
  so the adapter checks vendor liveness before resume. A watched Session that cannot be resumed
  stays readable and reports the vendor reason.

  A Session **is the root Agent** (`parentId: null`). Key attributes are **`harness`**
  (`claude | codex | …`), native ID, Project, and **`cwd`**. Managed facts are DIRECT when Argo
  observes them through its channel. Watched facts are vendor-sourced.

- **CLI title** — a name for the Session that the Harness itself holds, and that every surface
  the Harness draws already shows. DERIVED: Argo reads it through the vendor interface and never
  owns it. Two kinds, and the reader's outranks the summariser's whichever order they arrive in
  (#1623):
  - **summarised** — the Harness's own summariser wrote it from the conversation.
  - **custom** — a person entered it through the Harness or Argo's native rename operation.

  The first prompt is an Argo-derived name: the first thing the Session was asked, without the
  text the harness injects around it. A name that a reader enters in Argo travels to the CLI.
  It replaces a derived name because the reader chose it.

  Claude and Codex provide native rename operations through their adapters. A rename becomes
  visible only after the vendor accepts it.

  **Connecting a Ticket can rename the Session** (#2134), the same way a reader's own typed name
  does: Argo sends the Ticket's title through the native rename path and reads the accepted title
  back, so the result is indistinguishable from a person having typed it. The honesty tier decides
  whether Argo asks
  first: a `first-prompt` or `summarised` title cost the reader nothing to make, so it is replaced
  without asking; a `custom` title is a reader's own word and is only replaced with their
  confirmation. A rename the CLI refuses leaves the link in place — the link and the rename are
  two separate outcomes, and the link is never undone by a refused or skipped rename.

- **Session status** — the adapter's validated rollup of vendor lifecycle facts:
  - **starting** — Argo accepted a start or resume command and the managed channel is opening.
  - **running** — the vendor reports an active Turn.
  - **permission** — the managed Session waits for a permission decision.
  - **asking** — the Session waits for a structured answer.
  - **idle** — the vendor reports no active Turn.
  - **stopped** — the vendor ended the Turn with a stop reason such as a limit or refusal.
  - **ended** — the managed channel closed normally or after cancellation.
  - **unknown** — the vendor interface does not establish a more specific state.

  `starting` and `permission` require a managed channel. Watched status is only as specific as the
  vendor history and liveness interface allows. Argo never infers liveness from file age, process
  working directory, or an unfinished transcript record. An unsupported vendor value becomes
  `unknown`, not the nearest familiar value.

- **Entry** — optional vendor metadata describing how the Session started: **`interactive`** or
  **`headless`**. Absence represents unknown; Argo does not infer it
  from a transcript or hide the Session because of it.

- **Session Mode** — the Session's *standing autonomy stance*; defined once in the Autonomy
  cluster below. A Session (root-Agent) fact, not per-Subagent. DIRECT for managed, tier-gated
  for watched.

- **Model** and **Effort** — the Harness's own two knobs, which Argo states and sets and never
  interprets: which model the Session runs on, and how hard it is told to think. The adapter reads
  accepted values through the vendor interface and renders them VERBATIM. A model ID Argo's
  readable table has never heard of is a model, not an error. The same rule applies to a new
  effort value.

  A managed Session can show the launch value Argo sent until the vendor reports the accepted
  value. A watched Session shows only a value the vendor interface supplies. Missing remains
  `unknown`; Argo never fills it with a plausible default.

  The last chosen harness is remembered app-wide. Each harness remembers its own Model and Effort
  pair, using that harness's available choices when a new composer opens. A new composer is an
  unsent draft; the first Send starts the Session and fixes its harness. Model, Effort and Mode
  remain editable during the Session (#1692).

  A Codex Model or Effort chosen during a Session is a DIRECT choice for the next Turn, not a
  claim about the Turn already running. The composer states that timing. A setting a harness
  refused is never remembered as an accepted choice.

  **Neither is Mode**, and the separation is load-bearing (#558): Mode is Argo's standing autonomy
  stance and settles how far the agent may act before it stops, while these two settle what does
  the acting. Stating them together on one control would imply that changing the model changes how
  often you are asked. They sit on the composer beside Mode and NOT on the deck header, because a
  value stated in two places is one you keep in sync by eye.

  Whether either can be SET is declared per adapter, not discovered: an adapter that exposes
  neither draws no control for them at all.

- **`SessionFacts` — dissolved, not an entity.** git facts (`dirty/unpushed/headSha`) →
  **Workspace**; code-host facts (`pr/ci/review`) → **Delivery**; liveness/mode → **Session
  status/Mode**.
