import Foundation

/// Each way the transport refuses, in the health ledger's vocabulary — and `nil` for the one the
/// three cause words have no room for.
///
/// Exhaustive: a fifth transport failure fails the build until somebody words it (#1698).
extension HTTPTransportError {
    var fetchFailure: ProviderFetchError? {
        switch self {
        case .unauthorized: .grantRefused
        case .rateLimited: .rateLimited
        // The provider answered, with a status no caller can read as an answer. It was reached.
        case .status: .unreachable
        // A URL Argo built and cannot parse asked the provider nothing, so neither the network nor
        // the provider is what failed, and none of the words is true of it.
        case .malformedURL: nil
        }
    }
}
