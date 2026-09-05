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
            /// Which reading produced this link (`CONTEXT.md` Honesty tier). DIRECT is the number
            /// Argo was TOLD at the spawn; DERIVED is the one read off a branch by convention. The
            /// default is the lower of the two, so a link built without saying which never claims
            /// to be the firmer one (degrade-down).
            public let tier: Tier

            public init(number: Int, title: String? = nil, tier: Tier = .derived) {
                self.number = number
                self.title = title
                self.tier = tier
            }
        }

        public let id: String
        public let title: String
        public let model: String?
        /// The CLI's own word for the effort level, verbatim and unread (#558) — `ClaudeEffort`
        /// says what it means on the scale, and the composer states whatever this is either way.
        public let effort: String?
        public let workspaceLocation: String?
        /// Which agent program is running (`CONTEXT.md` L2). Absent where Argo cannot say, which
        /// is every Session read from a record whose CLI it did not recognise.
        public let cli: AgentCLI?
        /// How this Session's process was started (`CONTEXT.md` L2 · Entry) — DERIVED, and
        /// `interactive` wherever Argo read no word it recognised.
        public let entry: SessionEntry
        /// Absent for a Session with no git context at all, rather than an empty Workspace: a
        /// Workspace whose every field is `nil` is a claim that one exists.
        public let workspace: Workspace?
        public let access: Access
        public let status: SessionStatus
        /// Which Ticket this Session is on, and — where it is on none — which of the two ways
        /// that is true (#894). A reading rather than an optional, so a Session nobody could have
        /// read a link for is never drawn as one nothing named a Ticket for.
        public let ticket: TicketLinkReading
        /// The code host's pull request for this Session's branch (`CONTEXT.md` L1 · Delivery),
        /// and `nil` for a branch with none open. DERIVED, off `Readings.deliveries` rather than
        /// off anything the Hub reports.
        public let pullRequest: DeliveryPullRequest?
        /// Whether this Session's companion claim to be ready for a pull request still draws
        /// (`CONTEXT.md` L1 · Delivery, #1335) — already resolved against `pullRequest` above, so
        /// no surface below the shell re-asks whether an open pull request makes the claim stale.
        public let readyToShip: Bool
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
        /// `context` below, which is only what it is holding now.
        public let spentTokens: Int?
        /// The cache half of the same life — read and re-read once per request, so it dwarfs
        /// `spentTokens` by the turn count. Split out so neither figure inflates the other.
        public let cachedTokens: Int?
        /// What its subagents spent, of that total. **Absent, never zero**, where nothing
        /// reported any — which is every CLI in use today, and why the header drops the fact
        /// off its line rather than printing a zero that would claim no subagent ran.
        public let subagentTokens: Int?
        /// How full the Session's context is right now — the latest reading its records carry,
        /// DERIVED. `unread` where no record has reported a spend at all, which the header draws
        /// as NOTHING; `unreadable` is the one the header words `unknown` (#1249).
        public let context: ContextReading
        /// The Session this one handed its work to, as the id of the row that now carries it
        /// (`CONTEXT.md` L2 — the resume chain a handoff makes across two Sessions rather than
        /// within one). Absent for every Session that has not handed off, which is nearly all of
        /// them.
        public let handedOffTo: String?
        /// Whether the companion channel this Session's CONVENTION-tier facts arrive over is up
        /// (#493). `notApplicable` draws NOTHING rather than a negative claim.
        public let companionChannel: CompanionLiveness
        /// When the wait for this Session's first byte ran out with its process still up (#1245) —
        /// DIRECT, and the only thing on this value that can say why a row Argo started has
        /// neither spoken nor gone. Absent for every Session Argo did not start, and for every one
        /// that came up and printed something.
        public let startedQuietlyAtMs: Int?
        /// The waits Argo held here that have ENDED (#1323), oldest first — see
        /// `SessionWaitSettled`. Each drops into the reading as one settled row. Empty for every
        /// Session Argo did not start, which is what keeps the plinth DIRECT.
        public let settledWaits: [SessionWaitSettled]
        /// Whether this Session is continuing a chain rather than opening one (#1328) — DIRECT, off
        /// the engine's own `resuming`. `false` for every Session Argo did not start, which is what
        /// keeps the plinth off a resume nobody performed.
        public let resuming: Bool
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
        /// The Ticket the user attached this Session to by hand (#1092), and `nil` for one they
        /// never did — which is every Session whose link Argo derived off a branch. Argo's own
        /// fact, on `explicitName`'s ground, and the only thing that says whether the reader has a
        /// decision here to take back.
        public let pinnedTicket: Int?
        /// The Permission the Session's agent is blocked on, verbatim from the engine — DIRECT,
        /// because Argo holds the blocked hook itself. Absent for every Session that is not
        /// waiting on one, which is what returns the composer to its slot.
        public let permission: PermissionRequest?
        /// The question the Session's agent is blocked on (#712), verbatim from the engine —
        /// DIRECT, on the same ground the Permission above is. Absent for every Session that is not
        /// waiting on one, which is what returns the feed's ask row to being a reading.
        public let ask: SessionAsk?
        /// The question the Session's agent raised over the companion plugin and nobody has
        /// answered (#1205) — CONVENTION, and a reading rather than a handle: Argo answered the
        /// call the moment it arrived, so there is nothing here to answer down. Beside `ask` and
        /// never instead of it; the feed draws the two apart.
        public let companionAsk: CompanionAsk?
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
        /// Everything the transcript said, and the stamp the cockpit compares it by — see
        /// `Transcript`. Stored whole rather than unpacked into three fields, so this Session's
        /// synthesised equality answers about the stream in an integer comparison: unpacked, one
        /// body pass deep-compared every Session's whole decoded stream (ADR-0028 Rule 1).
        public let transcript: Transcript

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
            self.effort = chain.effort
            self.cli = chain.cli
            self.entry = chain.entry
            self.lastSeenAtMs = chain.lastSeenAtMs
            self.startedAtMs = chain.startedAtMs
            self.handedOffTo = chain.handedOffTo
            self.companionChannel = chain.companionChannel
            self.startedQuietlyAtMs = chain.startedQuietlyAtMs
            self.settledWaits = chain.settledWaits
            self.resuming = chain.resuming
            self.workspaceLocation = work.location
            self.workspace = work.workspace
            self.ticket = work.ticket
            self.pullRequest = work.pullRequest
            self.readyToShip = work.readyToShip
            self.spentTokens = spend.spentTokens
            self.cachedTokens = spend.cachedTokens
            self.subagentTokens = spend.subagentTokens
            self.context = spend.context
            self.permission = autonomy.permission
            self.ask = autonomy.ask
            self.companionAsk = autonomy.companionAsk
            self.standingAllows = autonomy.standingAllows
            self.expiredPermissions = autonomy.expiredPermissions
            self.mode = autonomy.mode
            self.modeDidNotTake = autonomy.modeDidNotTake
            self.isArchived = annotations.isArchived
            self.explicitName = annotations.explicitName
            self.pinnedTicket = annotations.pinnedTicket
            self.transcript = transcript
        }
    }
}

/// The three transcript facts, read off the one value that holds them — the shape every surface
/// below the shell already asks for.
public extension CockpitPresentation.Session {
    var events: [TranscriptEvent] {
        transcript.stream.events
    }

    /// The last Turn typed at this Session that the CLI never heard, verbatim (#682), and `nil` for
    /// every Turn that arrived. The composer cleared when the keystrokes were written, so this is
    /// the only thing that can put the words back.
    var lostTurn: String? {
        transcript.lostTurn
    }

    /// Whether Argo has typed a Turn nothing has answered yet (#1179) — the engine's own reading,
    /// carried through unchanged. It outranks the status word wherever the two disagree, which is
    /// what the composer asks it for.
    var hasUnansweredTurn: Bool {
        transcript.hasUnansweredTurn
    }
}
