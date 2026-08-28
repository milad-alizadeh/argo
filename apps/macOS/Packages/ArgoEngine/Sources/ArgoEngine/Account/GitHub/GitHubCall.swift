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
}
