import Foundation

/// The lifecycle strip's nodes, in the order a Delivery reaches them (`CONTEXT.md` L4).
///
/// A readout and not a router: the node a Delivery is at says how far the product in flight has
/// got, and nothing navigates by it.
public enum DeliveryStage: Equatable, Sendable, CaseIterable {
    case commits
    case pr
    case ci
    case review
    case merge
    case deploy
    case release

    /// Reserved: nothing observes a deployment, so `Delivery.stage` never answers with one.
    public var isReserved: Bool {
        switch self {
        case .commits, .pr, .ci, .review, .merge: false
        case .deploy, .release: true
        }
    }

    /// The nodes a derivation can answer with — every node that is not reserved.
    public static let wired = allCases.filter { !$0.isReserved }
}
