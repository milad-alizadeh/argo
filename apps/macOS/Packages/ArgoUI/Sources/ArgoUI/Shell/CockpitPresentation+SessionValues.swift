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

        /// When it ran. Neither moment is a duration alone, and the span is all either is read for.
        public struct Span: Equatable, Sendable {
            public let startedAtMs: Int?
            public let lastSeenAtMs: Int?

            public init(startedAtMs: Int? = nil, lastSeenAtMs: Int? = nil) {
                self.startedAtMs = startedAtMs
                self.lastSeenAtMs = lastSeenAtMs
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
