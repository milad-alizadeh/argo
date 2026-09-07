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
    /// Whether this ask may be answered "you already have it".
    ///
    /// Opt-in rather than automatic, because a `304` is only cheaper than a body if the CALLER can
    /// still produce an answer from what it holds — and most of them cannot (#1620). A request that
    /// leaves this `false` carries no validator, so the host has nothing to answer `304` against.
    ///
    /// Set after the fact rather than taken by the init, which is what keeps the ask itself — a
    /// URL, a verb, a body, an identity — the whole of what the init describes.
    public var revalidating = false

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

    /// The same ask, offered for validation.
    public func revalidated(_ revalidating: Bool) -> HTTPRequest {
        var asked = self
        asked.revalidating = revalidating
        return asked
    }

    public init(url: String, form: [String: String], bearerToken: String? = nil) {
        self.init(url: url, body: .form(form), bearerToken: bearerToken)
    }
}

/// What one request established: a body, or the host's word that the last body still stands.
///
/// The third outcome the health vocabulary has no room for. `ProviderFetchError` says why a read
/// did NOT land, and `unchanged` is not a failure — but it is not an answer either, and read as
/// one it is an EMPTY answer, which for a per-branch pull request read means "nobody opened one".
/// That reading would erase a mark on every tick that saved a request (#1620).
public enum HTTPReply: Sendable {
    case answered(Data)
    /// `304 Not Modified`: the validator we sent still matches, and this costs nothing against
    /// GitHub's primary rate limit.
    case unchanged
}

/// The seam the provider adapters read through.
///
/// Behind this protocol a test hands back a recorded provider response; in the app it is
/// `URLSession`.
public protocol HTTPTransport: Sendable {
    func send(_ request: HTTPRequest) async throws -> Data

    /// The same ask, for a caller that can act on `unchanged`.
    ///
    /// Defaulted rather than required, because a transport that keeps no validators cannot produce
    /// a `304` — it never sent an `If-None-Match` for one to be about.
    func fetch(_ request: HTTPRequest) async throws -> HTTPReply
}

public extension HTTPTransport {
    func fetch(_ request: HTTPRequest) async throws -> HTTPReply {
        try await .answered(send(request))
    }
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
