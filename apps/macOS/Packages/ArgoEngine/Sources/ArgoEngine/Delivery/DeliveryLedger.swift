import Foundation

/// What each Project's code host last answered with, keyed by branch, and the only place a Delivery
/// lives.
///
/// Nothing here is persisted (ADR-0008, ADR-0017), and a derivation is replaced whole or left
/// alone — never merged, which is what stops a failed read emptying a strip that was full.
public actor DeliveryLedger {
    private var derived: [String: [Delivery]] = [:]

    public init() {}

    public func record(_ deliveries: [Delivery], for projectID: String) {
        derived[projectID] = deliveries
    }

    /// Every Delivery derived for a Project, and none for a Project nothing has read yet — the
    /// health chip is what says whether that is an answer or a silence. No Project at all reads
    /// empty too, and never the last one's.
    public func deliveries(of projectID: String?) -> [Delivery] {
        projectID.flatMap { derived[$0] } ?? []
    }

    /// The one Delivery a branch is the life of, which is what every other layer joins by
    /// (`CONTEXT.md` L3 · Workspace).
    public func delivery(ofBranch branch: String, in projectID: String?) -> Delivery? {
        deliveries(of: projectID).first { $0.branch == branch }
    }
}
