import Foundation

/// One provider request, described rather than performed.
///
/// A form body means POST and its absence means GET, because those are the only two shapes any
/// OAuth grant has and a `method` string would let a caller ask for a third.
public struct HTTPRequest: Sendable {
    public let url: String
    public let form: [String: String]?
    public let bearerToken: String?

    public init(url: String, form: [String: String]? = nil, bearerToken: String? = nil) {
        self.url = url
        self.form = form
        self.bearerToken = bearerToken
    }
}

/// The seam the provider adapters read through.
///
/// The network is the one dependency the suite has no business reaching: a test that hits GitHub
/// is a test that fails on a plane, and the grant it would need is the thing being built. Behind
/// this protocol a test hands back a recorded provider response; in the app it is `URLSession`.
public protocol HTTPTransport: Sendable {
    func send(_ request: HTTPRequest) async throws -> Data
}

public enum HTTPTransportError: Error, Equatable {
    case malformedURL(String)
    /// The token was refused: revoked, expired, or never good for this read. Its own case because
    /// it is the Account-level failure (CONTEXT.md), whose blast radius is every Binding naming
    /// that Account — and because the recovery is authorizing again, not retrying.
    case unauthorized(code: Int)
    /// The provider answered, but not with a status the caller can read as an answer.
    case status(code: Int)
}
