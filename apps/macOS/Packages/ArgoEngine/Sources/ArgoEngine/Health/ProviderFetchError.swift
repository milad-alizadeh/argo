import Foundation

/// Why a read through a Binding did not land, in the vocabulary the health ledger records.
///
/// One vocabulary for both ports (`CONTEXT.md` → Ports): health is keyed on the Binding rather than
/// on what was being read, so two ports failing the same way must reach the ledger as one word.
///
/// A refused grant is its own case for the reason `HTTPTransportError.unauthorized` is: its blast
/// radius is the Account rather than the Binding, and its remedy is authorizing again.
public enum ProviderFetchError: Error, Equatable {
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
