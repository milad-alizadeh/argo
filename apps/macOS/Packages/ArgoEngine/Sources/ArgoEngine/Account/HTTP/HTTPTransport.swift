import Foundation

/// What a provider request carries, if anything.
///
/// Two cases because two providers: an OAuth grant is form-encoded by the spec, and Linear's API is
/// GraphQL, which is JSON or nothing.
public enum HTTPBody: Sendable {
    case form([String: String])
    case json(Data)
}

/// One provider request, described rather than performed.
///
/// A body means POST and its absence GET — the only two verbs anything behind this seam uses.
public struct HTTPRequest: Sendable {
    public let url: String
    public let body: HTTPBody?
    public let bearerToken: String?

    public init(url: String, body: HTTPBody? = nil, bearerToken: String? = nil) {
        self.url = url
        self.body = body
        self.bearerToken = bearerToken
    }

    public init(url: String, form: [String: String], bearerToken: String? = nil) {
        self.init(url: url, body: .form(form), bearerToken: bearerToken)
    }
}

/// The seam the provider adapters read through.
///
/// Behind this protocol a test hands back a recorded provider response; in the app it is
/// `URLSession`.
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
