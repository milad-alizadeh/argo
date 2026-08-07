public struct CockpitPresentation: Equatable, Sendable {
    public struct Project: Equatable, Identifiable, Sendable {
        public let id: String
        public let name: String
        public let location: String
        /// A registered folder that has moved or been deleted is still a Project. Drawn as such and
        /// re-pointable, rather than quietly missing from the strip.
        public let isReachable: Bool

        public init(id: String, name: String, location: String, isReachable: Bool = true) {
            self.id = id
            self.name = name
            self.location = location
            self.isReachable = isReachable
        }
    }

    public struct Session: Equatable, Identifiable, Sendable {
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
        public let operationalState: ArgoOperationalState?

        public init(
            id: String,
            title: String,
            model: String?,
            workspaceLocation: String?,
            branch: String?,
            access: Access,
            operationalState: ArgoOperationalState?,
        ) {
            self.id = id
            self.title = title
            self.model = model
            self.workspaceLocation = workspaceLocation
            self.branch = branch
            self.access = access
            self.operationalState = operationalState
        }
    }

    public enum Checkout: Equatable, Sendable {
        case branch(String)
        case detached(shortSHA: String)
        case unavailable
    }

    public enum Connection: Equatable, Sendable {
        case healthy
        case reconnecting
        case failed(message: String)
    }

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
