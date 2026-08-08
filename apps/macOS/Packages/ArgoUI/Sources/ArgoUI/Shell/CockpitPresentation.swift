import ArgoEngine

/// Everything one cockpit window renders, as values. The shell's whole input: no view reaches
/// past it to the Hub, and `CockpitPresentation(hub:)` is the only thing that reads one.
public struct CockpitPresentation: Equatable, Sendable {
    public struct Project: Equatable, Identifiable, Sendable {
        public let id: String
        public let name: String
        public let location: String
        /// A registered folder that has moved or been deleted is still a Project. Drawn as such and
        /// re-pointable, rather than quietly missing from the drawer.
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

    public struct Session: Equatable, Identifiable, Sendable {
        /// What the user can DO with a Session, which is the shell's question. Derived from
        /// provenance — see `Access(provenance:)` — and never asserted beside it.
        public enum Access: Equatable, Sendable {
            case managed
            case readOnly
        }

        public let id: String
        public let title: String
        public let model: String?
        public let workspaceLocation: String?
        public let branch: String?
        public let access: Access
        public let status: SessionStatus
        /// Everything the Session's transcript said, in order — the feed's whole input.
        ///
        /// The engine's own events rather than a second shape named for the shell: the surface
        /// that draws them is `FeedProjection`, and a presentation that pre-digested the stream
        /// would put the reading decisions somewhere no test can reach them. Empty by default, so
        /// a Session named for a fact about the roster does not have to invent a transcript.
        public let events: [TranscriptEvent]

        public init(
            id: String,
            title: String,
            model: String?,
            workspaceLocation: String?,
            branch: String?,
            access: Access,
            status: SessionStatus,
            events: [TranscriptEvent] = [],
        ) {
            self.id = id
            self.title = title
            self.model = model
            self.workspaceLocation = workspaceLocation
            self.branch = branch
            self.access = access
            self.status = status
            self.events = events
        }
    }

    /// The engine's own enums, named for the shell rather than restated as it. A second copy would
    /// be two vocabularies for one fact, kept in step by hand.
    public typealias Checkout = CheckoutProjection.Head
    public typealias Connection = HubConnection

    /// The registered set, plus — on a launch that named a folder nobody registered — the one it
    /// was pointed at. Pointing the Hub is not registration, and the strip draws where it points.
    public let projects: [Project]
    public let activeProjectID: Project.ID?
    public let sessions: [Session]
    public let checkout: Checkout
    public let connection: Connection

    public var activeProject: Project? {
        projects.first { $0.id == activeProjectID }
    }

    /// The Session a selection names, if the roster still holds it. A selection is an id and the
    /// roster moves under it, so every surface drawing the selected Session asks this rather than
    /// carrying its own lookup — and gets the same `nil` when the id has aged out.
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
