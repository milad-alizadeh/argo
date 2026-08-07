public struct CockpitPresentation: Equatable, Sendable {
    public struct Project: Equatable, Sendable {
        public let name: String
        public let location: String

        public init(name: String, location: String) {
            self.name = name
            self.location = location
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

    public let project: Project
    public let sessions: [Session]
    public let checkout: Checkout
    public let connection: Connection

    public init(
        project: Project,
        sessions: [Session],
        checkout: Checkout,
        connection: Connection,
    ) {
        self.project = project
        self.sessions = sessions
        self.checkout = checkout
        self.connection = connection
    }
}
