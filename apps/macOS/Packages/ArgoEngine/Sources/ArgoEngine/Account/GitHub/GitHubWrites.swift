import Foundation

/// One change put to GitHub, and the one place its refusal becomes the caller's reason.
struct GitHubWrites: Sendable {
    let call: GitHubCall

    init(transport: HTTPTransport) {
        self.call = GitHubCall(transport: transport)
    }

    func send(_ request: GitHubWriteRequest, grant: AccountGrant) async throws -> Data {
        try await refusalRead(
            call.request(request.path, method: request.method, body: request.body, grant: grant),
        )
    }

    /// A read on the write path, which reads a refusal the way a write does. Not `GitHubReads.get`:
    /// that one folds every failure body into `unreachable`, so a number behind which there is
    /// nothing would reach a writer as a broken connection.
    func read<Reply: Decodable>(_ path: String, grant: AccountGrant) async throws -> Reply {
        let data = try await refusalRead(call.request(path, grant: grant))
        guard let reply = try? GitHubCall.decoder.decode(Reply.self, from: data) else {
            throw WorkItemWriteError.unreachable(.unreachable)
        }
        return reply
    }

    /// The reply, or GitHub's own words about why there is not one.
    ///
    /// The body is read BEFORE it is parsed as the thing that was asked for: a 422 arrives as a
    /// body rather than a raised status, and read the other way round it would surface as a
    /// provider that did not respond — a retryable-looking word for a request that must never be
    /// resent.
    private func refusalRead(_ request: HTTPRequest) async throws -> Data {
        let data: Data
        do {
            data = try await call.transport.send(request)
        } catch {
            throw Self.failure(error)
        }
        if let failure = try? GitHubCall.decoder.decode(GitHubFailure.self, from: data) {
            throw WorkItemWriteError.refused(failure.reason)
        }
        return data
    }

    /// A 403 carrying a sentence is GitHub declining this write — a scope the token lacks, or a
    /// repository with dependencies turned off. Filed as a refused grant it would send the reader
    /// through an OAuth round-trip that fixes nothing and mark every Binding on that Account down.
    private static func failure(_ error: Error) -> WorkItemWriteError {
        if case let HTTPTransportError.unauthorized(code, reason) = error,
           code == 403, let reason {
            return .refused(reason)
        }
        return .unreachable(GitHubCall.fetchError(error))
    }

    /// The issue GitHub answered a write with, or the one read back where it answered with
    /// something else — a label list, the far end of an edge, nothing at all. Both are the
    /// provider's own word about the ticket. What adopting a reply rules out is the third
    /// possibility: the ticket the caller hoped for.
    func issue(
        from reply: Data?, at path: String, grant: AccountGrant,
    ) async throws
        -> GitHubIssue {
        if let reply, let issue = try? GitHubCall.decoder.decode(GitHubIssue.self, from: reply) {
            return issue
        }
        return try await read(path, grant: grant)
    }
}
