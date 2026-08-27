import Foundation

/// The code host port: the seam every Delivery fact is read through (`CONTEXT.md` → Ports).
///
/// One method, because a listing of what the host holds is what a derivation needs and Argo
/// performs no host mutations yet. A second code host is a second file conforming here, not a
/// branch in the derivation.
///
/// The port answers whole Deliveries rather than raw pull requests: what a Check is called and what
/// a verdict says is the adapter's to read verbatim, and nothing inward re-reads it.
public protocol CodeHostPort: Sendable {
    /// Every Delivery the grant can see in the scope, keyed by the branch each is the life of.
    func deliveries(in scope: String, grant: AccountGrant) async throws -> [Delivery]
}
