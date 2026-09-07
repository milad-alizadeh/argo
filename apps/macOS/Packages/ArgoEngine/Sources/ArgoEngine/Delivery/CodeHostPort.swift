import Foundation

/// The code host port: the seam every Delivery fact is read through (`CONTEXT.md` → Ports).
///
/// It answers whole Deliveries rather than raw pull requests, so the host's own words are read at
/// the boundary and nowhere else.
///
/// Every method answers a `PortReading` rather than a value, because the host has a third thing to
/// say: that what the caller holds is still current (#1620). `revalidating` is how the caller says
/// it is able to hear that — a caller holding nothing for this read must pass `false`, or a `304`
/// would leave it with no answer at all.
public protocol CodeHostPort: Sendable {
    /// Every Delivery still in flight, whether or not this machine has the branch — which is what
    /// puts a teammate's pull request in the room.
    func inFlight(
        in scope: String, grant: AccountGrant, revalidating: Bool,
    ) async throws
        -> PortReading<[Delivery]>

    /// What the host holds for one named branch, in flight or long merged, and `nil` where it holds
    /// nothing at all.
    ///
    /// Asked per branch rather than folded into the listing above, because the listing is bounded
    /// by what is open: reaching merge — a Delivery's terminal state — through it would mean
    /// walking every pull request a repository ever had, on every read.
    ///
    /// Asked by `BranchHead` rather than by a branch name, and that is what keeps a merged
    /// Delivery knowable: GitHub deletes a head branch as it merges it, so the branch stops being
    /// a name the host will answer to while the commit at its head stays one (ADR-0032). A caller
    /// holding no commit gets the branch reading alone.
    func delivery(
        of head: BranchHead, in scope: String, grant: AccountGrant, revalidating: Bool,
    ) async throws
        -> PortReading<Delivery?>
}
