import Foundation

/// GitHub's device flow, in two calls.
///
/// `requestChallenge` returns the code and the URL; `awaitGrant` then waits on them. Splitting it
/// there is the point: the caller has the code in hand before anything blocks, so the window shows
/// what the user must type instead of spinning on a secret it is holding (#265).
///
/// Nothing here opens a browser. That is the cockpit's half (#C) — the engine builds with no
/// window server (ADR-0022), and a flow that reached for one could not be run by `swift test`.
public struct GitHubDeviceFlow: Sendable {
    /// The wait between polls, injectable because a clock is the one thing a test may replace: the
    /// real one would make this suite take as long as the grant does.
    public typealias Sleeper = @Sendable (Duration) async throws -> Void

    private let transport: HTTPTransport
    private let sleep: Sleeper

    public init(
        transport: HTTPTransport = URLSessionTransport(),
        sleep: @escaping Sleeper = { try await Task.sleep(for: $0) },
    ) {
        self.transport = transport
        self.sleep = sleep
    }

    public func requestChallenge() async throws -> GitHubDeviceChallenge {
        let data = try await transport.send(HTTPRequest(
            url: GitHubOAuthApp.deviceCodeEndpoint,
            form: [
                "client_id": GitHubOAuthApp.clientID,
                "scope": GitHubOAuthApp.scopes.joined(separator: " "),
            ],
        ))
        return try Self.challenge(from: data)
    }

    /// Poll until GitHub says yes, no, or too late.
    ///
    /// The window is spent rather than watched: each wait is subtracted from what the challenge
    /// said it had, so an endpoint answering `authorization_pending` forever ends in `expired`
    /// rather than looping for as long as the app is open.
    public func awaitGrant(for challenge: GitHubDeviceChallenge) async throws -> AccountGrant {
        var interval = challenge.interval
        var remaining = challenge.expiresIn
        while remaining > .zero {
            try await sleep(interval)
            remaining -= interval
            switch try await poll(deviceCode: challenge.deviceCode) {
            case let .granted(grant): return grant
            case .pending: continue
            // GitHub's own instruction when a poll came too soon. It usually names the interval it
            // now wants; five seconds longer is the documented step only where it names none.
            case let .slowDown(asked): interval = asked ?? interval + .seconds(5)
            }
        }
        throw GitHubDeviceFlowError.expired
    }

    /// Who the grant belongs to. The numeric id is the Account's key and the login is a display
    /// attribute, so this is the read that decides whether a completed grant is a new Account or an
    /// identity already held under a name that has since changed.
    public func identity(with grant: AccountGrant) async throws -> AccountRecord {
        let data = try await transport.send(HTTPRequest(
            url: GitHubOAuthApp.userEndpoint,
            bearerToken: grant.accessToken,
        ))
        guard let user = try? Self.decoder.decode(UserResponse.self, from: data) else {
            throw GitHubDeviceFlowError.malformedResponse
        }
        return AccountRecord(
            provider: .github,
            providerAccountID: String(user.id),
            displayName: user.login,
        )
    }

    private func poll(deviceCode: String) async throws -> PollOutcome {
        let data = try await transport.send(HTTPRequest(
            url: GitHubOAuthApp.accessTokenEndpoint,
            form: [
                "client_id": GitHubOAuthApp.clientID,
                "device_code": deviceCode,
                "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
            ],
        ))
        if let failure = try? Self.decoder.decode(TokenErrorResponse.self, from: data) {
            return try Self.outcome(of: failure)
        }
        guard let token = try? Self.decoder.decode(TokenResponse.self, from: data) else {
            throw GitHubDeviceFlowError.malformedResponse
        }
        // The scope recorded is what came back, never what was asked for: an org that restricts
        // OAuth Apps can grant less, and that has to be legible afterwards rather than assumed.
        return .granted(AccountGrant(
            accessToken: token.accessToken,
            scopes: token.scope.split(separator: " ").map(String.init),
        ))
    }

    private static func outcome(of failure: TokenErrorResponse) throws -> PollOutcome {
        switch failure.error {
        case "authorization_pending": return .pending
        case "slow_down": return .slowDown(failure.interval.map(Duration.seconds))
        case "access_denied": throw GitHubDeviceFlowError.declined
        case "expired_token": throw GitHubDeviceFlowError.expired
        default:
            throw GitHubDeviceFlowError.refused(
                code: failure.error,
                description: failure.errorDescription ?? "",
            )
        }
    }
}
