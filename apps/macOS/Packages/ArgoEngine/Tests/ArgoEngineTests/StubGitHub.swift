@testable import ArgoEngine
import Foundation

/// GitHub, recorded. Hands back the queued response for each request in order, and remembers what
/// was asked and how long the flow waited between asks.
///
/// The bodies are GitHub's documented device-flow shapes rather than a convenient subset, so a
/// field the flow stops reading is a field this stub still sends — the drift the suite would
/// otherwise hide.
actor StubGitHub: HTTPTransport {
    enum Response {
        case deviceCode
        case pending
        case slowDown
        case slowDownBare
        case declined
        case refused
        case token
        case user
        case nonsense
        /// A refused token, which the transport raises rather than answers — a revoked grant never
        /// arrives as a body to parse.
        case revoked
    }

    private var queue: [Response]
    private var requests: [HTTPRequest] = []
    private var recordedWaits: [Duration] = []

    init(responses: [Response]) {
        self.queue = responses
    }

    func send(_ request: HTTPRequest) throws -> Data {
        requests.append(request)
        guard !queue.isEmpty else { return Data(Response.nonsense.body.utf8) }
        let response = queue.removeFirst()
        guard response != .revoked else { throw HTTPTransportError.unauthorized(code: 401) }
        return Data(response.body.utf8)
    }

    nonisolated var sleep: GitHubDeviceFlow.Sleeper {
        { duration in await self.record(wait: duration) }
    }

    func waits() -> [Duration] {
        recordedWaits
    }

    func forms() -> [[String: String]] {
        requests.compactMap(\.form)
    }

    func bearerTokens() -> [String] {
        requests.compactMap(\.bearerToken)
    }

    private func record(wait duration: Duration) {
        recordedWaits.append(duration)
    }
}

extension StubGitHub.Response {
    var body: String {
        switch self {
        case .deviceCode: """
            { "device_code": "3584d83530557fdd1f46af8289938c8ef79f9dc5",
              "user_code": "WDJB-MJHT",
              "verification_uri": "https://github.com/login/device",
              "expires_in": 900, "interval": 5 }
            """
        case .pending: #"{ "error": "authorization_pending" }"#
        // A number that is NOT the old interval plus the documented five, so honouring GitHub's
        // answer and stepping past it are two different observations.
        case .slowDown: #"{ "error": "slow_down", "interval": 20 }"#
        case .slowDownBare: #"{ "error": "slow_down" }"#
        case .declined: #"{ "error": "access_denied" }"#
        case .refused: """
            { "error": "device_flow_disabled",
              "error_description": "Device flow is not enabled for this app" }
            """
        case .token: """
            { "access_token": "ghu_granted", "token_type": "bearer", "scope": "repo" }
            """
        case .user: #"{ "id": 583231, "login": "octocat", "type": "User" }"#
        case .nonsense: #"{ "message": "Not Found" }"#
        // Raised by `send` before it ever reaches a body.
        case .revoked: ""
        }
    }
}

extension GitHubDeviceChallenge {
    /// A challenge as GitHub issues one, so a polling test starts where `requestChallenge` left
    /// off.
    static func stub(expiresIn: Duration = .seconds(900)) -> GitHubDeviceChallenge {
        GitHubDeviceChallenge(
            userCode: "WDJB-MJHT",
            verificationURL: URL(fileURLWithPath: "/dev/null"),
            deviceCode: "3584d83530557fdd1f46af8289938c8ef79f9dc5",
            interval: .seconds(5),
            expiresIn: expiresIn,
        )
    }
}
