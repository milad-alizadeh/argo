import Foundation

/// What `URLSession` raising means to the health ledger, and `nil` where it means nothing about
/// the connection.
///
/// The sibling of `HTTPTransportError.fetchFailure`, and the reason it cannot be exhaustive the
/// same way: `URLError.Code` is a struct over about ninety values, not an enum. So the two sets
/// below are named and the rest is the one reading left — a code that reached the wire and failed
/// there.
extension URLError {
    var fetchFailure: ProviderFetchError? {
        if Self.askedNothing.contains(code) {
            return nil
        }
        // Nothing was asked, so nothing was refused. Every other code reached the wire and failed
        // there, which is `unreachable`.
        return Self.offlineCodes.contains(code) ? .offline : .unreachable
    }

    /// The codes that mean this Mac has no network.
    private static var offlineCodes: Set<URLError.Code> {
        [.notConnectedToInternet, .networkConnectionLost, .dataNotAllowed]
    }

    /// The codes raised without putting the ask to the provider: a URL `URLSession` itself refused,
    /// and a task the window cancelled. Neither the network nor the provider is what failed, so
    /// none of the cause words is true of them (#1698).
    private static var askedNothing: Set<URLError.Code> {
        [.cancelled, .badURL, .unsupportedURL]
    }
}
