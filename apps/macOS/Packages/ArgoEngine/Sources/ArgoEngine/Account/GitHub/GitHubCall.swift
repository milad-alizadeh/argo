import Foundation

/// Asking GitHub for one path, and the one place a failure becomes the health ledger's vocabulary.
struct GitHubCall: Sendable {
    let transport: HTTPTransport

    /// GitHub is snake-case throughout.
    static var decoder: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return decoder
    }

    func request(
        _ path: String, method: HTTPMethod = .get, body: Data? = nil, grant: AccountGrant,
    )
        -> HTTPRequest {
        HTTPRequest(
            url: GitHubOAuthApp.apiHost + path,
            method: method,
            body: body.map(HTTPBody.json),
            bearerToken: grant.accessToken,
        )
    }

    func send(
        _ path: String, method: HTTPMethod = .get, body: Data? = nil, grant: AccountGrant,
    ) async throws
        -> Data {
        do {
            return try await transport.send(request(path, method: method, body: body, grant: grant))
        } catch {
            throw ProviderFetchError.reading(error)
        }
    }

    /// The same ask, told whether it may be answered with the host's word that nothing moved.
    ///
    /// Separate from `send` rather than replacing it: only a caller that can rebuild an answer
    /// from what it already holds has any use for `unchanged`, and every other caller here reads
    /// a body or nothing (#1620).
    func fetch(
        _ path: String, grant: AccountGrant, revalidating: Bool,
    ) async throws
        -> HTTPReply {
        do {
            return try await transport.fetch(
                request(path, grant: grant).revalidated(revalidating),
            )
        } catch {
            throw ProviderFetchError.reading(error)
        }
    }
}
