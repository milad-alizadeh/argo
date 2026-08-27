import Foundation

/// The code host port: the seam every Delivery fact is read through (`CONTEXT.md` → Ports).
///
/// It answers whole Deliveries rather than raw pull requests, so the host's own words are read at
/// the boundary and nowhere else.
public protocol CodeHostPort: Sendable {
    /// Every Delivery still in flight, whether or not this machine has the branch — which is what
    /// puts a teammate's pull request in the room.
    func inFlight(in scope: String, grant: AccountGrant) async throws -> [Delivery]

    /// What the host holds for one named branch, in flight or long merged, and `nil` where it holds
    /// nothing at all.
    ///
    /// Asked per branch rather than folded into the listing above, because the listing is bounded
    /// by what is open: reaching merge — a Delivery's terminal state — through it would mean
    /// walking every pull request a repository ever had, on every read.
    func delivery(
        ofBranch branch: String, in scope: String, grant: AccountGrant,
    ) async throws
        -> Delivery?
}
