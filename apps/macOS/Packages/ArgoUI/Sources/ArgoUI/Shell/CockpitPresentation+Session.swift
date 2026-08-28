import ArgoEngine

public extension CockpitPresentation {
    /// One Session as the cockpit renders it — the value every surface below the shell takes.
    struct Session: Equatable, Identifiable, Sendable {
        /// What the user can DO with a Session. Derived from provenance — see
        /// `Access(provenance:)` — and never asserted beside it.
        ///
        /// `external` was never Argo's; `orphaned` was — Argo spawned it and then lost the PTY
        /// with the process that owned it (`CONTEXT.md` L2). Both are read-only.
        public enum Access: CaseIterable, Equatable, Sendable {
            case managed
            case external
            case orphaned
        }

        /// Whether the Session's checkout is the Project's own or one it was given — the
        /// engine's own enum, aliased rather than restated.
        public typealias WorkspaceKind = WorkspaceProjection.Kind

        /// The git working context the Session is running in (`CONTEXT.md` L3).
        ///
        /// Every count is OPTIONAL because Argo may not have read git yet, and an unread count is
        /// a different claim from a clean tree.
        public struct Workspace: Equatable, Sendable {
            public let kind: WorkspaceKind?
            /// The join key (`CONTEXT.md` L3) — and the header's own subject line. Absent for a
            /// Session that has not branched, never a placeholder standing in for one.
            public let branch: String?
            public let dirty: Int?
            public let unpushed: Int?

            public init(
                kind: WorkspaceKind? = nil,
                branch: String? = nil,
                dirty: Int? = nil,
                unpushed: Int? = nil,
            ) {
                self.kind = kind
                self.branch = branch
                self.dirty = dirty
                self.unpushed = unpushed
            }
        }

        /// The Ticket this Session serves, as a LINK and never as its content
        /// (`CONTEXT.md` L1): Argo stores the reference, the provider owns the words. The title
        /// is read through and absent whenever the provider has not answered — which, with no
        /// provider connected, is always.
        public struct Issue: Equatable, Sendable {
            public let number: Int
            public let title: String?

            public init(number: Int, title: String? = nil) {
                self.number = number
                self.title = title
            }
        }

        public let id: String
        public let title: String
        public let model: String?
        public let workspaceLocation: String?
        /// Which agent program is running (`CONTEXT.md` L2). Absent where Argo cannot say, which
        /// is every Session read from a record whose CLI it did not recognise.
        public let cli: AgentCLI?
        /// Absent for a Session with no git context at all, rather than an empty Workspace: a
        /// Workspace whose every field is `nil` is a claim that one exists.
        public let workspace: Workspace?
        public let access: Access
        public let status: SessionStatus
        /// The linked Ticket, when there is a provider to have read one from. `nil` covers
        /// both "no provider connected" and "connected, and this Session is unlinked" — the
        /// difference belongs to a provider surface, and neither renders a link here.
        public let issue: Issue?
        /// When this Session was last seen to run, in milliseconds since the epoch. The Hub's own
        /// sort key rather than a second reading of it. Absent where neither the records nor the
        /// file behind them could say — a gap, never a moment standing in for one.
        public let lastSeenAtMs: Int?
        /// When this Session first did anything, in milliseconds since the epoch — the oldest
        /// moment its records report. With `lastSeenAtMs` above it, the pair IS the Session's
        /// wall-clock span; alone, neither of them is a duration.
        public let startedAtMs: Int?
        /// What the Session has spent across its whole life, in tokens — every reported spend
        /// summed, both grains (`CONTEXT.md` L3), cache excluded. The opposite reading from
        /// `contextTokens` below, which is only what it is holding now.
        public let spentTokens: Int?
        /// The cache half of the same life — read and re-read once per request, so it dwarfs
        /// `spentTokens` by the turn count. Split out so neither figure inflates the other.
        public let cachedTokens: Int?
        /// What its subagents spent, of that total. **Absent, never zero**, where nothing
        /// reported any — which is every CLI in use today, and why the header drops the fact
        /// off its line rather than printing a zero that would claim no subagent ran.
        public let subagentTokens: Int?
        /// How full the Session's context is right now, in tokens — the latest reading its records
        /// carry, DERIVED. Absent for a record that reported no spend at all, which the header
        /// draws as `unknown`: unreadable is not an empty context.
        public let contextTokens: Int?
        /// The Session this one handed its work to, as the id of the row that now carries it
        /// (`CONTEXT.md` L2 — the resume chain a handoff makes across two Sessions rather than
        /// within one). Absent for every Session that has not handed off, which is nearly all of
        /// them.
        public let handedOffTo: String?
        /// Whether the user cleared this Session off the roster. Argo's own fact and not a
        /// reading of anything (`CONTEXT.md` "Storage & ownership"): nothing observed sets it,
        /// which is why new activity on an archived Session leaves it archived (#502, story 16)
        /// and why a merged branch does not clear its Session (story 14).
        public let isArchived: Bool
        /// The name the user gave this Session, beside — never instead of — the `title` above:
        /// the derived one has to survive being overridden, or the Reset in the rename dialog
        /// would have nothing to go back to (#502, story 20). Argo's own fact, and absent for a
        /// Session nobody renamed. Which of the two the surfaces DRAW is `SessionTitle`'s.
        public let explicitName: String?
        /// The Permission the Session's agent is blocked on, verbatim from the engine — DIRECT,
        /// because Argo holds the blocked hook itself. Absent for every Session that is not
        /// waiting on one, which is what returns the composer to its slot.
        public let permission: PermissionRequest?
        /// The question the Session's agent is blocked on (#712), verbatim from the engine —
        /// DIRECT, on the same ground the Permission above is. Absent for every Session that is not
        /// waiting on one, which is what returns the feed's ask row to being a reading.
        public let ask: SessionAsk?
        /// The tools this Session has stopped asking about (#572), verbatim from the engine and in
        /// the order they were granted. Empty for a Session that has granted none, which is every
        /// Session until somebody says otherwise.
        public let standingAllows: [StandingAllow]
        /// The Permissions this Session's gate refused when nobody answered them (#573), verbatim
        /// from the engine and in the order they expired. Empty for every Session whose prompts
        /// were all answered, cancelled, or are still waiting — which is every Session in practice,
        /// since the gate waits a day.
        public let expiredPermissions: [PermissionExpiry]
        /// The Session's standing autonomy stance, as Argo can state it (ADR-0025) — the rung,
        /// whether it is the nearest rather than the exact one, and the CLI's own word for it.
        /// `unknown` covers both the Session nobody has read a stance off and the one whose
        /// boundary Argo cannot see.
        public let mode: SessionModeReading
        /// The rung Argo asked for and the CLI then contradicted, and `nil` for every ordinary
        /// reading (#629). `mode` above has already snapped to the real rung, so this is the only
        /// thing that can say why the control moved without the user touching it.
        public let modeDidNotTake: SessionMode?
        /// The last Turn typed at this Session that the CLI never heard, verbatim (#682), and
        /// `nil` for every Turn that arrived. The composer cleared when the keystrokes were
        /// written, so this is the only thing that can put the words back.
        public let lostTurn: String?
        /// Everything the Session's transcript said, in order — the feed's whole input. The
        /// engine's own events, undigested; `FeedProjection` is what draws them.
        public let events: [TranscriptEvent]
        /// Each Subagent's own reading, keyed by the CLI's id for it (#711) — what the rail scopes
        /// the one feed onto. Undigested for the reason `events` is, and empty for the Session that
        /// delegated nothing, which is most of them.
        public let subagentEvents: [String: [TranscriptEvent]]

        /// Grouped by the reading each fact comes from (#755). The four ungrouped parameters are
        /// the four no default can supply; every value below defaults, so a fixture still names
        /// only the fact it is about.
        ///
        /// The unpacking under it is edge 5's second subject: each fact lands on the slot of its
        /// own name unless a `renamed:` line says otherwise.
        ///
        /// renamed: workspaceLocation <- location — `location` alone would not say WHICH.
        public init(
            id: String,
            title: String,
            access: Access,
            status: SessionStatus,
            chain: Chain = .init(),
            work: Work = .init(),
            spend: Spend = .init(),
            autonomy: Autonomy = .init(),
            annotations: Annotations = .init(),
            transcript: Transcript = .init(),
        ) {
            self.id = id
            self.title = title
            self.access = access
            self.status = status
            self.model = chain.model
            self.cli = chain.cli
            self.lastSeenAtMs = chain.lastSeenAtMs
            self.startedAtMs = chain.startedAtMs
            self.handedOffTo = chain.handedOffTo
            self.workspaceLocation = work.location
            self.workspace = work.workspace
            self.issue = work.issue
            self.spentTokens = spend.spentTokens
            self.cachedTokens = spend.cachedTokens
            self.subagentTokens = spend.subagentTokens
            self.contextTokens = spend.contextTokens
            self.permission = autonomy.permission
            self.ask = autonomy.ask
            self.standingAllows = autonomy.standingAllows
            self.expiredPermissions = autonomy.expiredPermissions
            self.mode = autonomy.mode
            self.modeDidNotTake = autonomy.modeDidNotTake
            self.isArchived = annotations.isArchived
            self.explicitName = annotations.explicitName
            self.events = transcript.events
            self.subagentEvents = transcript.subagentEvents
            self.lostTurn = transcript.lostTurn
        }
    }
}
