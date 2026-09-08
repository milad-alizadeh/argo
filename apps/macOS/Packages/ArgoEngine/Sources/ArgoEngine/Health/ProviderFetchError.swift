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

public extension ProviderFetchError {
    /// Every way an ask through the TRANSPORT can fail, in this vocabulary — and `nil` where none
    /// of the four words is true of the failure. Shared by both adapters rather than spelled
    /// per-provider, so two providers failing the same way cannot reach the ledger as two states.
    ///
    /// All four words describe something a provider or a network did, so an error raised anywhere
    /// but the wire is none of them and gets none of them (#1698).
    static func reading(_ error: Error) -> ProviderFetchError? {
        switch error {
        case let transportError as HTTPTransportError: transportError.fetchFailure
        case let urlError as URLError: urlError.fetchFailure
        default: nil
        }
    }

    /// The same, for a throw that may ALREADY be in this vocabulary — which is every `catch` over a
    /// port, whose adapters throw these and whose own failures throw everything else. `reading`
    /// alone would flatten a port's own `rateLimited` to `unreachable`, and the cause words are the
    /// half of the health reading a reader acts on.
    static func refusal(_ error: Error) -> ProviderFetchError? {
        error as? ProviderFetchError ?? reading(error)
    }
}
