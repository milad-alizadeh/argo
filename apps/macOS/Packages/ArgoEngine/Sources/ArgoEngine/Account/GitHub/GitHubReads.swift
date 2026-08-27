import Foundation

/// Asking GitHub for one path, and turning every way an ask can fail into the one vocabulary the
/// health ledger records.
struct GitHubReads: Sendable {
    let transport: HTTPTransport

    /// A hundred is GitHub's own ceiling for `per_page`; a short page is the last page.
    private static let pageSize = 100
    /// A runaway backstop and not a working limit: a read that walked forever would leave the
    /// health chip claiming a read still in flight.
    private static let pageLimit = 20

    func get<Reply: Decodable>(_ path: String, grant: AccountGrant) async throws -> Reply {
        let data = try await send(path, grant: grant)
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        // Checked before the reply, not after it fails to parse: a 4xx GitHub hands back as a BODY
        // passes through the transport like any other answer, and read as an unparseable reply it
        // would surface as a provider that did not respond.
        if (try? decoder.decode(GitHubFailure.self, from: data)) != nil {
            throw ProviderFetchError.unreachable
        }
        guard let reply = try? decoder.decode(Reply.self, from: data) else {
            throw ProviderFetchError.unreachable
        }
        return reply
    }

    /// Every item of one listing, walked until a short page ends it or the backstop does. The
    /// paging parameters are appended here, so nothing else in the module spells `per_page`.
    func pages<Page: GitHubPage>(
        _: Page.Type, of path: String, grant: AccountGrant,
    ) async throws
        -> [Page.Item] {
        var items: [Page.Item] = []
        let separator = path.contains("?") ? "&" : "?"
        for page in 1 ... Self.pageLimit {
            let read: Page = try await get(
                "\(path)\(separator)per_page=\(Self.pageSize)&page=\(page)", grant: grant,
            )
            items.append(contentsOf: read.items)
            if read.items.count < Self.pageSize {
                break
            }
        }
        return items
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
                ? ProviderFetchError.offline
                : ProviderFetchError.unreachable
        }
    }

    private static func fetchError(_ error: HTTPTransportError) -> ProviderFetchError {
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
