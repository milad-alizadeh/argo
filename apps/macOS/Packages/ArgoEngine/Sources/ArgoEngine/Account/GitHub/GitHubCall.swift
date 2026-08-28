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
            throw Self.fetchError(error)
        }
    }

    /// Every way an ask can fail, in the health ledger's words. Shared by the reads and the writes,
    /// so two failing the same way cannot reach the ledger as two states.
    static func fetchError(_ error: Error) -> ProviderFetchError {
        switch error {
        case HTTPTransportError.unauthorized: .grantRefused
        case HTTPTransportError.rateLimited: .rateLimited
        // Nothing was asked, so nothing was refused. Every other `URLError` reached the wire and
        // failed there, which is `unreachable`.
        case let urlError as URLError where offline.contains(urlError.code): .offline
        default: .unreachable
        }
    }

    /// The `URLError` codes that mean this Mac has no network.
    private static let offline: Set<URLError.Code> = [
        .notConnectedToInternet, .networkConnectionLost, .dataNotAllowed,
    ]
}
