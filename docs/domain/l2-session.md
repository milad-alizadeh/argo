## L2 · Session

- **Session** — one vendor conversation with an Argo UUID and a unique **Harness + native Session
  ID** pair. The UUID identifies the Session in Argo; the pair identifies it at the vendor. A
  Claude Session and a Codex Session never merge, even if their titles or Project match. A fork is
  a separate Session with its own Argo UUID and native ID. One SQLite table holds the UUID, pair,
  and indexed vendor metadata. Its Project link is nullable. A new vendor working directory can
  move the Session to another Project. A missing directory keeps the known Project. Deleting a
  Project leaves the Session in the global Session list.

  A Session has no durable live-channel posture. An app-scoped live Session supervisor actor owns
  the live Session actors. Each live Session actor invokes one Harness machine, owns prompt order, and
  stops with the application. A Session without a live actor remains readable through vendor
  history; the first new prompt attempts native resume. A live channel is not durable across an
  Argo restart.

  Vendor history is the source of Feed truth. Live vendor events add immediate updates. Metadata
  synchronization commits vendor changes to SQLite and tells readers to refresh the affected
  projection. A transcript or rollout file is never an Argo domain object or input.

  Origin does not gate resume (ADR-0040). Argo has one application window. The adapter checks
  vendor liveness before resume because another vendor client can still hold the Session. A
  Session actor has no SQLite lease and cannot prove that an external vendor client is absent. A
  Session that cannot be
  resumed because of a temporary condition stays readable and reports the vendor reason. Argo
  removes a Session only when its Harness confirms that the vendor conversation cannot be resumed
  again. Removing it also removes its custom title, pin, and user-asserted Ticket link.

  A Session **is the root Agent** (`parentId: null`). Key attributes are **`harness`**
  (`claude | codex | …`), native ID, Project, and **`cwd`**. Facts from a live channel are DIRECT.
  Facts read later from vendor history are vendor-sourced.

- **Custom title** — one reader-chosen name shared by Argo and the vendor. The Harness reads it
  through the vendor interface. An authoritative vendor read can change or clear it. A future
  Argo rename writes through the vendor and stores its confirmed value. The displayed name is the
  custom title, then the current title of a linked Ticket, then the vendor preview, then the first
  prompt. The preview is vendor metadata, not another custom title. The first prompt is the first
  thing the Session was asked, without text the Harness injects. Missing optional metadata does
  not erase a known value. Connecting a Ticket does not copy its title into the Session.

- **Session status** — the adapter's validated rollup of vendor lifecycle facts:
  - **starting** — Argo accepted a start or resume command and a live channel is opening.
  - **running** — the vendor reports an active Turn.
  - **permission** — the live Session waits for a permission decision.
  - **asking** — the Session waits for a structured answer.
  - **idle** — the vendor reports no active Turn.
  - **stopped** — the vendor ended the Turn with a stop reason such as a limit or refusal.
  - **ended** — the live channel closed normally or after cancellation.
  - **unknown** — the vendor interface does not establish a more specific state.

  `starting` and `permission` require a live channel. Status without one is only as specific as the
  vendor history and liveness interface allows. Argo never infers liveness from file age, process
  working directory, or an unfinished transcript record. An unsupported vendor value becomes
  `unknown`, not the nearest familiar value.

- **Entry** — optional vendor metadata describing how the Session started: **`interactive`** or
  **`headless`**. Absence represents unknown; Argo does not infer it
  from a transcript. The first Claude list sync discovers external interactive Sessions and reads
  known Argo-created Sessions by ID. It does not import unrelated headless SDK runs. This scope
  does not make Entry a kind of Session.

- **Session Mode** — the Session's *standing autonomy stance*; defined once in the Autonomy
  cluster below. A Session (root-Agent) fact, not per-Subagent. DIRECT while Argo owns the live
  channel, and tier-gated when it does not.

- **Model** and **Effort** — the Harness's own two knobs, which Argo states and sets and never
  interprets: which model the Session runs on, and how hard it is told to think. The adapter reads
  accepted values through the vendor interface and renders them VERBATIM. A model ID Argo's
  readable table has never heard of is a model, not an error. The same rule applies to a new
  effort value.

  A live Session can show the launch value Argo sent until the vendor reports the accepted
  value. A Session without a live channel shows only a value the vendor interface supplies. Missing remains
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
