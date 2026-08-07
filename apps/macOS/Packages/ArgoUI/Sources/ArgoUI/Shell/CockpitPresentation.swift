import ArgoEngine

/// Everything one cockpit window renders, as values. The shell's whole input: no view reaches
/// past it to the Hub, and `CockpitPresentation(hub:)` is the only thing that reads one.
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
