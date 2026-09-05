import ArgoEngine

/// The readings a `Session` is assembled from — one value per reading, and the whole shape of
/// `Session.init` (ADR-0027, amended by #755).
///
/// They group the parameter list and are NOT what a Session stores; nothing reads through one.
/// Each field keeps the engine's own name for its fact, which is what `swift-boundaries.sh`
/// edge 5 compares the init's slots against.
public extension CockpitPresentation.Session {
    /// The resume chain (`CONTEXT.md` L2): what runs it, when it ran, what it handed to, and
    /// whether Argo's own channel to it is up — a property of the process this link runs in, which
    /// is what `Program` and the two moments are about too. Those four clauses are the parameter
    /// list, and the facts under them stay flat.
    struct Chain: Equatable, Sendable {
        /// What is running the chain, and how it was started. No call site names one of the three
        /// without the others: they are all read off the same records, at the same moment.
        public struct Program: Equatable, Sendable {
            public let cli: AgentCLI?
            public let model: String?
            /// The CLI's own word for the effort level, verbatim and unread (#558). Beside `model`
            /// because they are the CLI's own two knobs and are read off the same records at the
            /// same moment — what the composer states, and neither of them Argo's own.
            public let effort: String?
            /// `interactive` by default, which is degrade-down rather than a guess — see
            /// `SessionEntry`.
            public let entry: SessionEntry

            public init(
                cli: AgentCLI? = nil,
                model: String? = nil,
                effort: String? = nil,
                entry: SessionEntry = .interactive,
            ) {
                self.cli = cli
                self.model = model
                self.effort = effort
                self.entry = entry
            }
        }

        /// The wait for a link's own fresh PTY, off the engine's own `startup` and `resuming`
        /// (#1245, #1328) — grouped because both name the one wait Argo is timing on the process
        /// itself, never on a record. Beside `Span` rather than inside it: nested any deeper and
        /// `Chain.Span.Startup` breaks the two-level cap this file's own inits are already at.
        public struct Startup: Equatable, Sendable {
            /// When the wait ran out with the process still up. Absent for every Session Argo did
            /// not start and every one that came up and printed something.
            public let quietAtMs: Int?
            /// Whether the wait is a resume rather than a plain start. `false` for every Session
            /// Argo did not start, which is what keeps the plinth off a resume nobody performed.
            public let resuming: Bool

            public init(quietAtMs: Int? = nil, resuming: Bool = false) {
                self.quietAtMs = quietAtMs
                self.resuming = resuming
            }
        }

        /// When it ran, and the waits Argo timed inside that. Neither of the first two moments is a
        /// duration alone, and the span is all either is read for.
        public struct Span: Equatable, Sendable {
            public let startedAtMs: Int?
            public let lastSeenAtMs: Int?
            public let startup: Startup
            /// The waits Argo HELD on this link that have ended (#1323), oldest first — see
            /// `SessionWaitSettled`. Here beside the three moments because it is the same kind of
            /// fact: a stretch of this link's life that Argo timed itself, and one no CLI wrote a
            /// word about. Empty for every Session Argo did not start.
            public let settledWaits: [SessionWaitSettled]

            public init(
                startedAtMs: Int? = nil,
                lastSeenAtMs: Int? = nil,
                startup: Startup = .init(),
                settledWaits: [SessionWaitSettled] = [],
            ) {
                self.startedAtMs = startedAtMs
                self.lastSeenAtMs = lastSeenAtMs
                self.startup = startup
                self.settledWaits = settledWaits
            }
        }

        public let cli: AgentCLI?
        public let model: String?
        public let effort: String?
        public let entry: SessionEntry
        public let startedAtMs: Int?
        public let lastSeenAtMs: Int?
        public let handedOffTo: String?
        public let companionChannel: CompanionLiveness
        public let startedQuietlyAtMs: Int?
        /// The waits Argo held on this link that have ENDED (#1323), oldest first. A property of
        /// the process rather than of the record, which is why it is here beside the moment above:
        /// no CLI wrote a word about any of them. Empty for every Session Argo did not start.
        public let settledWaits: [SessionWaitSettled]
        /// Whether this link is continuing a chain rather than opening one (#1328) — beside the
        /// moments above for the same reason: a property of the process, not of the record.
        public let resuming: Bool

        public init(
            program: Program = .init(),
            span: Span = .init(),
            handedOffTo: String? = nil,
            companionChannel: CompanionLiveness = .notApplicable,
        ) {
            self.cli = program.cli
            self.model = program.model
            self.effort = program.effort
            self.entry = program.entry
            self.startedAtMs = span.startedAtMs
            self.lastSeenAtMs = span.lastSeenAtMs
            self.handedOffTo = handedOffTo
            self.companionChannel = companionChannel
            self.startedQuietlyAtMs = span.startup.quietAtMs
            self.settledWaits = span.settledWaits
            self.resuming = span.startup.resuming
        }
    }

    /// Where the Session is working and what it is working ON — the git context, the folder it
    /// sits in, the Ticket reading its branch feeds, and the pull request the same branch is the
    /// life of. The four arrive together because every one of the last three is DERIVED off the
    /// branch the first two name.
    struct Work: Equatable, Sendable {
        public let location: String?
        public let workspace: Workspace?
        public let ticket: TicketLinkReading
        /// The code host's pull request for this branch
        /// (`CockpitPresentation.Readings.deliveries`),
        /// and `nil` for a branch with none open — or one Argo has not read a Delivery for yet.
        /// Never a placeholder: the roster row draws nothing rather than guess.
        public let pullRequest: DeliveryPullRequest?
        /// Whether the Session's companion claim to be ready for a pull request still draws
        /// (#1335) — resolved against `pullRequest` HERE, once, so no surface downstream re-asks
        /// the staleness question (`cockpit-roster-row.md`, decision 7: an open pull request
        /// always wins over the claim).
        public let readyToShip: Bool

        /// The two facts a branch's own pull request settles together — grouped so `Work`'s own
        /// init stays at its cap (rules/house.md, edge 6) rather than growing a fifth parameter.
        public struct Delivery: Equatable, Sendable {
            public let pullRequest: DeliveryPullRequest?
            public let readyToShip: Bool

            public init(pullRequest: DeliveryPullRequest? = nil, readyToShip: Bool = false) {
                self.pullRequest = pullRequest
                self.readyToShip = readyToShip
            }
        }

        /// `unread` is the default because it is the quietest: a Work value built without saying
        /// anything about a Ticket has established nothing about one.
        public init(
            location: String? = nil,
            workspace: Workspace? = nil,
            ticket: TicketLinkReading = .unread,
            delivery: Delivery = .init(),
        ) {
            self.location = location
            self.workspace = workspace
            self.ticket = ticket
            self.pullRequest = delivery.pullRequest
            self.readyToShip = delivery.readyToShip
        }
    }

    /// The Session's Usage (`CONTEXT.md` L3), every figure in tokens and every one of them
    /// OPTIONAL — a record that reported no spend is unread, not spent-nothing.
    struct Spend: Equatable, Sendable {
        public let spentTokens: Int?
        public let cachedTokens: Int?
        public let subagentTokens: Int?
        /// How full the window is, with its own absence in it (#1249) — see `ContextReading`.
        public let context: ContextReading

        public init(
            spentTokens: Int? = nil,
            cachedTokens: Int? = nil,
            subagentTokens: Int? = nil,
            context: ContextReading = .unread,
        ) {
            self.spentTokens = spentTokens
            self.cachedTokens = cachedTokens
            self.subagentTokens = subagentTokens
            self.context = context
        }
    }

    /// Autonomy (`CONTEXT.md`): the standing stance, and everything the Session is blocked on or
    /// has stopped being blocked on.
    struct Autonomy: Equatable, Sendable {
        /// What the Session is blocked on RIGHT NOW, one slot per channel the block arrives over.
        /// They are read together at the same moment off the same claim, and no call site names
        /// one without knowing about the others — a surface that drew two of them at once would
        /// be putting two things to the reader as the one act.
        public struct Blocked: Equatable, Sendable {
            public let permission: PermissionRequest?
            public let ask: SessionAsk?
            /// The question the agent REPORTED over the companion plugin (#1205) — CONVENTION,
            /// beside `ask` and never merged into it: this one carries no handle Argo can answer
            /// down, so a surface handed it in `ask`'s slot would offer an answer reaching nobody.
            public let companionAsk: CompanionAsk?

            public init(
                permission: PermissionRequest? = nil,
                ask: SessionAsk? = nil,
                companionAsk: CompanionAsk? = nil,
            ) {
                self.permission = permission
                self.ask = ask
                self.companionAsk = companionAsk
            }
        }

        public let mode: SessionModeReading
        public let modeDidNotTake: SessionMode?
        public let permission: PermissionRequest?
        public let ask: SessionAsk?
        public let companionAsk: CompanionAsk?
        public let standingAllows: [StandingAllow]
        public let expiredPermissions: [PermissionExpiry]

        public init(
            mode: SessionModeReading = .unknown(cli: nil),
            modeDidNotTake: SessionMode? = nil,
            blocked: Blocked = .init(),
            standingAllows: [StandingAllow] = [],
            expiredPermissions: [PermissionExpiry] = [],
        ) {
            self.mode = mode
            self.modeDidNotTake = modeDidNotTake
            self.permission = blocked.permission
            self.ask = blocked.ask
            self.companionAsk = blocked.companionAsk
            self.standingAllows = standingAllows
            self.expiredPermissions = expiredPermissions
        }
    }

    /// Argo's own decisions about a chain id — the one reading that comes off `SessionAnnotations`
    /// rather than off anything observed.
    struct Annotations: Equatable, Sendable {
        public let isArchived: Bool
        public let explicitName: String?
        /// The Ticket a reader attached by hand, `nil` where they never did (#1092). Beside the
        /// link itself rather than inside it: the link says which Ticket this Session is ON, and
        /// this says whether the reader may take that decision back.
        public let pinnedTicket: Int?

        public init(
            isArchived: Bool = false,
            explicitName: String? = nil,
            pinnedTicket: Int? = nil,
        ) {
            self.isArchived = isArchived
            self.explicitName = explicitName
            self.pinnedTicket = pinnedTicket
        }
    }

    // `Transcript` is the sixth, and lives in `CockpitPresentation+Transcript.swift` — it is the
    // one of the six that a Session STORES, because it carries the stamp its equality rests on.
}
