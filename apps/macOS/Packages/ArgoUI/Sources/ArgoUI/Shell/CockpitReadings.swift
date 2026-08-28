import ArgoEngine

public extension CockpitPresentation {
    /// What the WINDOW knows about a Session that the Hub does not: Argo's own decisions about a
    /// chain id, and whether there is a Ticket provider to have read a link through (#894).
    ///
    /// One value rather than two parameters, because both cross the same seam, neither is a Hub
    /// fact, and the projection's initialisers are already at the cap (rules/code-style.md).
    struct Readings: Equatable, Sendable {
        public let annotations: SessionAnnotations
        /// Whether the active Project has a Ticket Binding. The one fact that separates a Session
        /// nobody could have read a link for from one nothing named a Ticket for.
        public let isTicketProviderBound: Bool

        /// A window that has decided nothing and is bound to nothing — the honest default for a
        /// test and for the render harness, and what a launch holds before onboarding.
        public static let none = Readings()

        /// The window's readings with the Binding taken off the health the chip already reads —
        /// so the port is named here, in the package, rather than derived in the app target
        /// where no test could reach the derivation (ADR-0022).
        public init(_ annotations: SessionAnnotations, over health: ConnectionHealthReading) {
            self.init(
                annotations: annotations, isTicketProviderBound: health.isBound(.ticket),
            )
        }

        public init(
            annotations: SessionAnnotations = .empty,
            isTicketProviderBound: Bool = false,
        ) {
            self.annotations = annotations
            self.isTicketProviderBound = isTicketProviderBound
        }
    }
}
