import Foundation

/// Why a read through a Binding did not land, in the vocabulary the health ledger records.
///
/// One vocabulary for both ports (`CONTEXT.md` → Ports), because health is keyed on the Binding and
/// not on what was being read: a Work Item listing and a Delivery derivation that fail the same way
/// must reach `ConnectionHealthLedger` as the same word, or one Binding renders two states.
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
