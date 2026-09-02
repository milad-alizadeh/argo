import ArgoEngine

/// The readings a `Session` is assembled from — one value per reading, and the whole shape of
/// `Session.init` (ADR-0027, amended by #755).
///
/// They group the parameter list and are NOT what a Session stores; nothing reads through one.
/// Each field keeps the engine's own name for its fact, which is what `swift-boundaries.sh`
/// edge 5 compares the init's slots against.
public extension CockpitPresentation.Session {
    /// The resume chain (`CONTEXT.md` L2): what runs it, when it ran, what it handed to, and
    /// whether Argo's own channel to it is up.
    ///
    /// The channel belongs to this reading and not to `Autonomy` beside it: it is a property of the
    /// process this chain link is running in, which is what `cli` and the two moments are about.
    struct Chain: Equatable, Sendable {
        public let cli: AgentCLI?
        public let model: String?
        public let startedAtMs: Int?
        public let lastSeenAtMs: Int?
        public let handedOffTo: String?
        public let companionChannel: CompanionLiveness

        public init(
            cli: AgentCLI? = nil,
            model: String? = nil,
            startedAtMs: Int? = nil,
            lastSeenAtMs: Int? = nil,
            handedOffTo: String? = nil,
            companionChannel: CompanionLiveness = .notApplicable,
        ) {
            self.cli = cli
            self.model = model
            self.startedAtMs = startedAtMs
            self.lastSeenAtMs = lastSeenAtMs
            self.handedOffTo = handedOffTo
            self.companionChannel = companionChannel
        }
    }

    /// Where the Session is working and what it is working ON — the git context, the folder it
    /// sits in, and the Ticket reading its branch feeds. The three arrive together because one
    /// half of that reading is DERIVED from the other two.
    struct Work: Equatable, Sendable {
        public let location: String?
        public let workspace: Workspace?
        public let ticket: TicketLinkReading

        /// `unread` is the default because it is the quietest: a Work value built without saying
        /// anything about a Ticket has established nothing about one.
        public init(
            location: String? = nil,
            workspace: Workspace? = nil,
            ticket: TicketLinkReading = .unread,
        ) {
            self.location = location
            self.workspace = workspace
            self.ticket = ticket
        }
    }

    /// The Session's Usage (`CONTEXT.md` L3), every figure in tokens and every one of them
    /// OPTIONAL — a record that reported no spend is unread, not spent-nothing.
    struct Spend: Equatable, Sendable {
        public let spentTokens: Int?
        public let cachedTokens: Int?
        public let subagentTokens: Int?
        public let contextTokens: Int?

        public init(
            spentTokens: Int? = nil,
            cachedTokens: Int? = nil,
            subagentTokens: Int? = nil,
            contextTokens: Int? = nil,
        ) {
            self.spentTokens = spentTokens
            self.cachedTokens = cachedTokens
            self.subagentTokens = subagentTokens
            self.contextTokens = contextTokens
        }
    }

    /// Autonomy (`CONTEXT.md`): the standing stance, and everything the Session is blocked on or
    /// has stopped being blocked on.
    struct Autonomy: Equatable, Sendable {
        public let mode: SessionModeReading
        public let modeDidNotTake: SessionMode?
        public let permission: PermissionRequest?
        public let ask: SessionAsk?
        public let standingAllows: [StandingAllow]
        public let expiredPermissions: [PermissionExpiry]

        public init(
            mode: SessionModeReading = .unknown(cli: nil),
            modeDidNotTake: SessionMode? = nil,
            permission: PermissionRequest? = nil,
            ask: SessionAsk? = nil,
            standingAllows: [StandingAllow] = [],
            expiredPermissions: [PermissionExpiry] = [],
        ) {
            self.mode = mode
            self.modeDidNotTake = modeDidNotTake
            self.permission = permission
            self.ask = ask
            self.standingAllows = standingAllows
            self.expiredPermissions = expiredPermissions
        }
    }

    /// Argo's own decisions about a chain id — the one reading that comes off `SessionAnnotations`
    /// rather than off anything observed.
    struct Annotations: Equatable, Sendable {
        public let isArchived: Bool
        public let explicitName: String?

        public init(isArchived: Bool = false, explicitName: String? = nil) {
            self.isArchived = isArchived
            self.explicitName = explicitName
        }
    }

    // `Transcript` is the sixth, and lives in `CockpitPresentation+Transcript.swift` — it is the
    // one of the six that a Session STORES, because it carries the stamp its equality rests on.
}
