import Foundation

/// The branch→ticket links a human asserted, which is one of only two categories of owned state
/// Argo persists (ADR-0017).
///
/// It exists because the join derives to `unlinked` for an ordinary hand-named branch, and without
/// somewhere to put the answer the room would empty for every branch outside `/implement`. It is
/// **not** an override: `DeliveryWorkItemLink.derived` consults it last, so an assertion can never
/// contradict a closing reference or a number the branch itself carries.
///
/// Keyed by Project as well as by branch, because two Projects can have a branch of one name and
/// they are different products in flight.
public struct DeliveryAssertions: Codable, Equatable, Sendable {
    private var branches: [String: [String: Int]]

    public init() {
        self.branches = [:]
    }

    public func number(ofBranch branch: String, in projectID: String) -> Int? {
        branches[projectID]?[branch]
    }

    public mutating func assert(_ number: Int, forBranch branch: String, in projectID: String) {
        branches[projectID, default: [:]][branch] = number
    }

    /// Withdraw the assertion. The branch reads `unlinked` again, which is what it derived to
    /// before anybody said otherwise.
    public mutating func withdraw(branch: String, in projectID: String) {
        branches[projectID]?[branch] = nil
    }
}
