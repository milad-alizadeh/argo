import ArgoEngine

/// Everything one cockpit window renders, as values. The shell's whole input: no view reaches
/// past it to the Hub, and `CockpitPresentation(hub:)` is the only thing that reads one.
public struct CockpitPresentation: Equatable, Sendable {
    public struct Project: Equatable, Identifiable, Sendable {
        public let id: String
        public let name: String
        public let location: String
        /// A registered folder that has moved or been deleted is still a Project.
        public let isReachable: Bool
        /// A launch pointed at a folder nobody registered is drawn where the window points, but it
        /// is not in the registry — so the verbs that read or write a record do not apply to it.
        public let isRegistered: Bool
        /// How many Sessions the cockpit is watching here. Absent — never zero — for a Project
        /// nothing has observed: the Hub is pointed at one Project at a time, so a count for any
        /// other is a fact Argo does not have.
        public let liveSessionCount: Int?

        public init(
            id: String,
            name: String,
            location: String,
            isReachable: Bool = true,
            isRegistered: Bool = true,
            liveSessionCount: Int? = nil,
        ) {
            self.id = id
            self.name = name
            self.location = location
            self.isReachable = isReachable
            self.isRegistered = isRegistered
            self.liveSessionCount = liveSessionCount
        }

        func counting(liveSessions: Int?) -> Project {
            Project(
                id: id,
                name: name,
                location: location,
                isReachable: isReachable,
                isRegistered: isRegistered,
                liveSessionCount: liveSessions,
            )
        }
    }

    /// The engine's own enums, named for the shell rather than restated as it.
    public typealias Checkout = CheckoutProjection.Head
    public typealias Connection = HubConnection

    /// The registered set, plus — on a launch that named a folder nobody registered — the one it
    /// was pointed at. Pointing the Hub is not registration, and the strip draws where it points.
    public let projects: [Project]
    public let activeProjectID: Project.ID?
    public let sessions: [Session]
    public let checkout: Checkout
    public let connection: Connection
    /// Where a Subagent's own reading is asked for — see `FeedAgentReader`. A reader rather than
    /// the readings, so a child's bytes reach the lane that draws them and not this value (#858).
    ///
    /// Written after the init rather than through it, because the init's parameter cap only ever
    /// descends (#755) and this is the one fact here that no caller but the Hub projection
    /// supplies. `internal(set)` and not `private(set)`: the projection that fills it is a file of
    /// its own, and a private setter in Swift is file-scoped. Read-only outside the package, which
    /// is what every `let` beside it means here.
    public internal(set) var subagents = FeedAgentReader.unread

    public var activeProject: Project? {
        projects.first { $0.id == activeProjectID }
    }

    /// The Session a selection names, if the roster still holds it — the roster moves under an id,
    /// so every surface asks here rather than carrying its own lookup.
    public func session(_ id: Session.ID?) -> Session? {
        guard let id else { return nil }
        return sessions.first { $0.id == id }
    }

    public init(
        projects: [Project],
        activeProjectID: Project.ID?,
        sessions: [Session],
        checkout: Checkout,
        connection: Connection,
    ) {
        self.projects = projects
        self.activeProjectID = activeProjectID
        self.sessions = sessions
        self.checkout = checkout
        self.connection = connection
    }
}
