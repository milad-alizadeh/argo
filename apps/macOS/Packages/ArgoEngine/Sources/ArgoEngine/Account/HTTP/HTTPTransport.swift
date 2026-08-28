import Foundation

/// What a provider request carries, if anything.
///
/// Two cases because two providers: an OAuth grant is form-encoded by the spec, and Linear's API is
/// GraphQL, which is JSON or nothing.
public enum HTTPBody: Sendable {
    case form([String: String])
    case json(Data)
}

/// Which verb a request is sent with.
///
/// Reads and OAuth exchanges only ever needed the first two; the other two are what a Ticket
/// write resolves to (#257) — GitHub edits an issue with `PATCH` and drops a label, a dependency or
/// a sub-issue with `DELETE`. No `PUT`, because nothing asks for one.
public enum HTTPMethod: String, Sendable {
    case get = "GET"
    case post = "POST"
    case patch = "PATCH"
    case delete = "DELETE"
}

/// One provider request, described rather than performed.
public struct HTTPRequest: Sendable {
    public let url: String
    public let method: HTTPMethod
    public let body: HTTPBody?
    public let bearerToken: String?

    /// An unnamed verb is read off the body — POST where there is one, GET where there is not,
    /// which is what every read and every OAuth exchange already assumed.
    public init(
        url: String,
        method: HTTPMethod? = nil,
        body: HTTPBody? = nil,
        bearerToken: String? = nil,
    ) {
        self.url = url
        self.method = method ?? (body == nil ? .get : .post)
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
    /// Carries the provider's own sentence where it wrote one: GitHub answers a write it will not
    /// perform with the same 403 it refuses a token with, and only the body tells "this token lacks
    /// the scope" from "this token is finished".
    case unauthorized(code: Int, reason: String?)
    /// The provider answered with a limit rather than data. Its own case because it shares a status
    /// code with a refused token — GitHub throttles with a 403 — and only the response HEADERS tell
    /// the two apart, which nothing behind this seam sees. Collapsed into `unauthorized` it sends a
    /// user who has to wait through an OAuth round-trip that fixes nothing.
    case rateLimited
    /// The provider answered, but not with a status the caller can read as an answer.
    case status(code: Int)
}
