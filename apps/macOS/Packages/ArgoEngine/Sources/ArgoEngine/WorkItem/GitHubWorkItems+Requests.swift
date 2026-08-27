import Foundation

/// Asking GitHub, and turning every way an ask can fail into the one vocabulary the health ledger
/// records.
extension GitHubWorkItems {
    func get<Reply: Decodable>(_ path: String, grant: AccountGrant) async throws -> Reply {
        let data = try await send(path, grant: grant)
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        // Checked before the reply, not after it fails to parse: a 4xx GitHub hands back as a BODY
        // passes through the transport like any other answer, and read as an unparseable reply it
        // would surface as a provider that did not respond.
        if (try? decoder.decode(GitHubFailure.self, from: data)) != nil {
            throw WorkItemFetchError.unreachable
        }
        guard let reply = try? decoder.decode(Reply.self, from: data) else {
            throw WorkItemFetchError.unreachable
        }
        return reply
    }

    private func send(_ path: String, grant: AccountGrant) async throws -> Data {
        do {
            return try await transport.send(HTTPRequest(
                url: GitHubOAuthApp.apiHost + path, bearerToken: grant.accessToken,
            ))
        } catch let error as HTTPTransportError {
            throw Self.fetchError(error)
        } catch let error as URLError {
            throw Self.offline.contains(error.code)
                ? WorkItemFetchError.offline
                : WorkItemFetchError.unreachable
        }
    }

    private static func fetchError(_ error: HTTPTransportError) -> WorkItemFetchError {
        switch error {
        case .unauthorized: .grantRefused
        case .rateLimited: .rateLimited
        case .malformedURL, .status: .unreachable
        }
    }

    /// The `URLError` codes that mean this Mac has no network — nothing was asked, so nothing was
    /// refused. Every other code reached the wire and failed there, which is `unreachable`.
    private static let offline: Set<URLError.Code> = [
        .notConnectedToInternet, .networkConnectionLost, .dataNotAllowed,
    ]
}
