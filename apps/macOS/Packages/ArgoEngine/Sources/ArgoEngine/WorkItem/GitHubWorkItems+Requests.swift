import Foundation

/// Asking GitHub, and turning every way an ask can fail into the one vocabulary the health ledger
/// records.
extension GitHubWorkItems {
    static let host = "https://api.github.com"

    func get<Reply: Decodable>(_ path: String, grant: AccountGrant) async throws -> Reply {
        let data = try await send(path, grant: grant)
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        // Checked before the reply, not after it fails to parse: GitHub hands its throttle back as
        // a 4xx body, which `URLSessionTransport` passes through like any other answer. Read as an
        // unparseable reply it would surface as `unreachable`, and the one cause whose remedy is
        // waiting would be the one cause nothing can see.
        if let failure = try? decoder.decode(FailureBody.self, from: data) {
            throw failure.fetchError
        }
        guard let reply = try? decoder.decode(Reply.self, from: data) else {
            throw WorkItemFetchError.unreachable
        }
        return reply
    }

    private func send(_ path: String, grant: AccountGrant) async throws -> Data {
        do {
            return try await transport.send(HTTPRequest(
                url: Self.host + path, bearerToken: grant.accessToken,
            ))
        } catch let error as HTTPTransportError {
            switch error {
            case .unauthorized: throw WorkItemFetchError.grantRefused
            case .malformedURL, .status: throw WorkItemFetchError.unreachable
            }
        } catch let error as URLError {
            throw Self.offline.contains(error.code)
                ? WorkItemFetchError.offline
                : WorkItemFetchError.unreachable
        }
    }

    /// The `URLError` codes that mean this Mac has no network — nothing was asked, so nothing was
    /// refused. Every other code reached the wire and failed there, which is `unreachable`.
    private static let offline: Set<URLError.Code> = [
        .notConnectedToInternet, .networkConnectionLost, .dataNotAllowed,
    ]

    /// GitHub's own error shape. Only the throttle is separable from it: the rest are a scope that
    /// no longer resolves or an undocumented refusal, and both read as a provider that did not
    /// answer.
    private struct FailureBody: Decodable {
        let message: String

        var fetchError: WorkItemFetchError {
            message.lowercased().contains("rate limit") ? .rateLimited : .unreachable
        }
    }
}
