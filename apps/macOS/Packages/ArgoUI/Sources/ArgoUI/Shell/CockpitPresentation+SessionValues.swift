import ArgoEngine

/// The readings a `Session` is assembled from — one value per reading, and the whole shape of
/// `Session.init` (ADR-0027, amended by #755 and by #1503).
///
/// A Session STORES them, and every fact below is declared here and nowhere else: the flat surface
/// a view reads is derived off these, in `CockpitPresentation+SessionFacts.swift`, rather than
/// copied onto a second set of fields. Each field keeps the engine's own name for its fact, so the
/// init's slots read against the engine's own surface one for one (ADR-0027) — convention held in
/// review since #1532 deleted the gate that checked it.
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

        public let program: Program
        public let span: Span
        public let handoff: Handoff
        /// Beside the three values rather than inside one: it is a property of Argo's own channel
        /// to the process, and none of the three is about that. What the fact IS, and what draws
        /// it, is on `Session.companionChannel`.
        public let companionChannel: CompanionLiveness

        /// Four values and no unpacking (#1503). Every fact under them is declared by the value
        /// that holds it and by nothing else; what a surface reads is `Session`'s own flat reading
        /// of them, in `CockpitPresentation+SessionFacts.swift`.
        public init(
            program: Program = .init(),
            span: Span = .init(),
            handoff: Handoff = .init(),
            companionChannel: CompanionLiveness = .notApplicable,
        ) {
            self.program = program
            self.span = span
            self.handoff = handoff
            self.companionChannel = companionChannel
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
        /// What the branch's own pull request settles — see `Delivery` below, which resolves the
        /// two against each other rather than letting a surface do it twice.
        public let delivery: Delivery

        /// The two facts a branch's own pull request settles together — grouped so `Work`'s own
        /// init stays at the four-parameter cap (`apps/macOS/.swiftlint.yml`) rather than growing
        /// a fifth parameter. What each fact IS, and what draws it, is on `Session.pullRequest`
        /// and `Session.readyToShip`; what is here is why the pair is resolved in one place.
        public struct Delivery: Equatable, Sendable {
            public let pullRequest: DeliveryPullRequest?
            public let readyToShip: Bool

            /// Takes the CONVENTION claim RAW and resolves it here, which is what makes a stale
            /// claim unrepresentable (#1335): there is no way to hand this an open pull request
            /// and a drawn `Ready` together, so no surface — and no fixture — can state the pair
            /// the design forbids.
            ///
            /// A pull request the host has not finished with always wins
            /// (`cockpit-roster-row.md`, decision 7), and a word the host uses that Argo cannot
            /// place counts as unfinished — see `DeliveryPullRequest.isFinished`. A merged or
            /// closed one does not win: a fresh claim after either is not a lie.
            public init(pullRequest: DeliveryPullRequest? = nil, claim: CompanionReady? = nil) {
                self.pullRequest = pullRequest
                self.readyToShip = claim != nil && pullRequest?.isFinished != false
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
            self.delivery = delivery
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
        /// What the Session is blocked on right now — see `Blocked`, which is where the three
        /// channels are declared and the only place they are.
        public let blocked: Blocked
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
            self.blocked = blocked
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

    // `Transcript` is the sixth, and lives in `CockpitPresentation+Transcript.swift` — it was the
    // first of the six a Session stored, because it carries the stamp its equality rests on, and
    // the shape the other five took in #1503.
}
