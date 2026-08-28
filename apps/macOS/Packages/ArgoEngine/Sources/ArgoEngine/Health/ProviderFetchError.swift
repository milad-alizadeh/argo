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
    /// Every way an ask can fail, in this vocabulary. Shared by both adapters rather than spelled
    /// per-provider, so two providers failing the same way cannot reach the ledger as two states.
    static func reading(_ error: Error) -> ProviderFetchError {
        switch error {
        case HTTPTransportError.unauthorized: .grantRefused
        case HTTPTransportError.rateLimited: .rateLimited
        // Nothing was asked, so nothing was refused. Every other `URLError` reached the wire and
        // failed there, which is `unreachable`.
        case let urlError as URLError where offlineCodes.contains(urlError.code): .offline
        default: .unreachable
        }
    }

    /// The `URLError` codes that mean this Mac has no network.
    private static var offlineCodes: Set<URLError.Code> {
        [.notConnectedToInternet, .networkConnectionLost, .dataNotAllowed]
    }
}
