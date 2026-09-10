import ArgoEngine

public extension CockpitPresentation {
    /// What the WINDOW knows about a Session that the Hub does not: Argo's own decisions about a
    /// chain id, and whether there is a Ticket provider to have read a link through (#894).
    ///
    /// One value rather than two parameters, because both cross the same seam, neither is a Hub
    /// fact, and the projection's initialisers are already at the cap (rules/house.md).
    struct Readings: Equatable, Sendable {
        public let annotations: SessionAnnotations
        /// Whether the active Project has a Ticket Binding. The one fact that separates a Session
        /// nobody could have read a link for from one nothing named a Ticket for.
        public let isTicketProviderBound: Bool
        /// Where a Subagent's own reading is asked for (#858). A Hub fact, unlike the two above,
        /// but the one that is ASKED for rather than carried: a fan-out's files grow the whole time
        /// an agent works, and copied into the projection every batch rebuilt the whole cockpit.
        public let subagents: FeedAgentReader
        /// What the active Project's code host was last asked and answered, keyed by branch
        /// (`DeliveryLedger.deliveries(of:)`). Empty for a Project nothing has read yet — never a
        /// placeholder Delivery standing in for a branch nobody asked about.
        public let deliveries: [Delivery]

        /// A window that has decided nothing and is bound to nothing — the honest default for a
        /// test and for the render harness, and what a launch holds before onboarding.
        public static let none = Readings()

        /// The window's readings with the Binding taken off the health the chip already reads —
        /// so the port is named here, in the package, rather than derived in the app target
        /// where no test could reach the derivation (ADR-0022).
        public init(
            _ annotations: SessionAnnotations,
            over health: ConnectionHealthReading,
            asking subagents: FeedAgentReader = .unread,
            deliveries: [Delivery] = [],
        ) {
            self.init(
                annotations: annotations,
                isTicketProviderBound: health.isBound(.ticket),
                subagents: subagents,
                deliveries: deliveries,
            )
        }

        public init(
            annotations: SessionAnnotations = .empty,
            isTicketProviderBound: Bool = false,
            subagents: FeedAgentReader = .unread,
            deliveries: [Delivery] = [],
        ) {
            self.annotations = annotations
            self.isTicketProviderBound = isTicketProviderBound
            self.subagents = subagents
            self.deliveries = deliveries
        }

        /// The pull request a branch's life answers to, off the set this window read — the same
        /// join `DeliveryLedger.delivery(ofBranch:in:)` makes, taken here because the window holds
        /// the reading and not the ledger itself. `nil` for a branch with none open, or one this
        /// window has not read a Delivery for.
        func pullRequest(forBranch branch: String) -> DeliveryPullRequest? {
            deliveries.first { $0.branch == branch }?.pullRequest
        }
    }
}
