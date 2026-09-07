import Foundation

/// The code host's live channel: what it PUSHES about a scope's Deliveries, rather than what it
/// answers when asked (`CONTEXT.md` → Ports).
///
/// A fast path and never the only one. Every reason this port has to refuse — a grant that may not
/// make one, a repository the user does not administer, a host that has withdrawn the mechanism —
/// is a throw the caller degrades to the poll on, and the poll stays at its own interval regardless
/// (#1579).
public protocol CodeHostWatch: Sendable {
    /// Open a watch on one scope, or throw where the host will not open one.
    func open(_ scope: String, grant: AccountGrant) async throws -> any DeliveryWatch
}

/// One open watch on a scope.
public protocol DeliveryWatch: Sendable {
    /// Waits until the host says a Delivery in this scope moved, and throws once the watch has
    /// ended — which is the caller's signal to open another and derive again.
    ///
    /// It answers nothing about WHAT moved. This seam changes when a derivation runs, never what it
    /// derives, so a caller that learned anything here would have two sources for one fact.
    func nextMove() async throws
    func close() async
}
