## L2 · Session

- **Session** — one vendor conversation with an Argo UUID and a unique **Harness + native Session
  ID** pair. The UUID identifies the Session in Argo; the pair identifies it at the vendor. A
  Claude Session and a Codex Session never merge, even if their titles or Project match. A fork is
  a separate Session with its own Argo UUID and native ID.

  Vendor sync upserts the Harness and native ID pair to assign or reuse the Argo UUID. The
  managed actor sends the first prompt. If Argo cannot save the UUID after the vendor starts,
  the result stays uncertain; later vendor sync can discover the Session without replaying
  that prompt.

  A Session has one current posture: **`managed | watched`**. `managed` means Argo owns its live
  channel and can drive it through the Harness adapter. `watched` means Argo owns no live channel;
  the Session is readable but not drivable. A live channel is not durable across an Argo restart,
  so every surviving Session starts watched and can become managed through native resume. Opening a
  watched Session reads its history without acquiring a live channel; the first new prompt attempts
  native resume.

  Vendor history is the source of Feed truth for both postures. Managed vendor events add immediate
  updates. For watched Sessions, a filesystem watcher can signal that history changed, but the
  adapter reads the change through the vendor interface. A transcript or rollout file is never an
  Argo domain object or input.

  Origin does not gate resume (ADR-0040). Argo has one application window, and its managed
  Session actor serializes start, resume, and Turn events. The adapter checks vendor liveness
  before resume because another vendor client can still hold the Session. A watched Session that
  cannot be resumed because of a temporary condition stays readable and reports the vendor reason. Argo
  removes a Session only when its Harness confirms that the vendor conversation cannot be resumed
  again. Removing it also removes its Argo title, pin, and user-asserted Ticket link.

  A Session **is the root Agent** (`parentId: null`). Key attributes are **`harness`**
  (`claude | codex | …`), native ID, Project, and **`cwd`**. Managed facts are DIRECT when Argo
  observes them through its channel. Watched facts are vendor-sourced.

- **Vendor title** — a name for the Session that the Harness itself holds. DERIVED: Argo reads it
  through the vendor interface and never owns it. Two kinds, and the reader's outranks the
  summariser's whichever order they arrive in (#1623):
  - **summarised** — the Harness's own summariser wrote it from the conversation.
  - **custom** — a person entered it through the Harness.

  **Argo title** — an optional, Argo-owned name for the Session. It takes precedence over every
  vendor title in Argo, including one changed later in another app. Renaming in Argo changes this
  title and does not rename the vendor Session. The displayed name is the Argo title, then the
  current title of a linked Ticket, then the vendor title, then the first prompt. The first prompt
  is the first thing the Session was asked, without text the Harness injects. Connecting a Ticket
  changes the displayed name only while no reader has set an Argo title; Argo does not copy the
  Ticket title into the Session.

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
