import Foundation

/// The Work Item provider port: the seam every listing is read through (`CONTEXT.md` → Ports).
///
/// One method, because a listing is what a poll needs and Argo performs no provider mutations
/// yet. A second provider is a second file conforming here, not a branch in the poll.
public protocol WorkItemPort: Sendable {
    /// Whether this provider carries a priority at all — a capability, known before any read, and
    /// therefore not something a `nil` on one ticket could ever say. It decides whether a priority
    /// affordance EXISTS; `WorkItem.priority` decides what a present one shows.
    var carriesPriority: Bool { get }

    /// Every Work Item the grant can see in the scope, children and verified blockers included.
    func list(in scope: String, grant: AccountGrant) async throws -> [WorkItem]
}

/// Why a listing did not land, in the vocabulary the health ledger records.
///
/// A refused grant is its own case for the reason `HTTPTransportError.unauthorized` is: its blast
/// radius is the Account rather than the Binding, and its remedy is authorizing again.
public enum WorkItemFetchError: Error, Equatable {
    case grantRefused
    case offline
    case unreachable
    case rateLimited

    /// The binding-level cause, and `nil` for the refusal that is not one.
    public var cause: ConnectionCause? {
        switch self {
        case .grantRefused: nil
        case .offline: .offline
        case .unreachable: .unreachable
        case .rateLimited: .rateLimited
        }
    }
}
