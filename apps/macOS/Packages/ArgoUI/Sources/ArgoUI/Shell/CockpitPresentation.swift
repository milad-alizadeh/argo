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
        /// How many Sessions the cockpit is watching here. Absent — never zero — for a Project
        /// nothing has observed: the Hub is pointed at one Project at a time, so a count for any
        /// other is a fact Argo does not have.
        public let liveSessionCount: Int?

        public init(
            id: String,
            name: String,
            location: String,
            isReachable: Bool = true,
            liveSessionCount: Int? = nil,
        ) {
            self.id = id
            self.name = name
            self.location = location
            self.isReachable = isReachable
            self.liveSessionCount = liveSessionCount
        }

        func counting(liveSessions: Int?) -> Project {
            Project(
                id: id,
                name: name,
                location: location,
                isReachable: isReachable,
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

        public init(
            id: String,
            title: String,
            model: String?,
            workspaceLocation: String?,
            branch: String?,
            access: Access,
            status: SessionStatus,
        ) {
            self.id = id
            self.title = title
            self.model = model
            self.workspaceLocation = workspaceLocation
            self.branch = branch
            self.access = access
            self.status = status
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
