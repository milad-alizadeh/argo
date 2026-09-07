import Foundation

/// The code host's live channel, filled by GitHub's webhook forwarder.
///
/// GitHub runs a forwarder that removes the need for the public endpoint a desktop app has never
/// had: `POST /repos/{scope}/hooks` with `"name": "cli"` and no `config.url` answers with a
/// `ws_url`
/// to dial, and each delivery arrives down that socket in well under a second (#1579).
///
/// The hook is ephemeral and this is why nothing here deletes one: GitHub reaps it within two
/// seconds of the socket dropping, a clean close and a killed process alike. So it cannot leak, it
/// cannot outlive the Project that made it, and there is never a second one to reuse — which is
/// also why the grant needs no `admin:repo_hook`, the scope only list, read and delete demand.
public struct GitHubDeliveryWatch: CodeHostWatch {
    private let call: GitHubCall
    private let sockets: any WebSocketTransport

    public init(
        transport: HTTPTransport = URLSessionTransport(),
        sockets: any WebSocketTransport = URLSessionWebSocket(),
    ) {
        self.call = GitHubCall(transport: transport)
        self.sockets = sockets
    }

    public func open(_ scope: String, grant: AccountGrant) async throws -> any DeliveryWatch {
        let created = try await call.send(
            "/repos/\(scope)/hooks", method: .post, body: Self.creating(), grant: grant,
        )
        let hook = try? GitHubCall.decoder.decode(GitHubForwarderHook.self, from: created)
        guard let url = hook?.wsUrl else { throw ProviderFetchError.unreachable }
        // The RAW token, with no `Bearer` prefix — which is not what any of GitHub's HTTP endpoints
        // take (`cli/gh-webhook`, `webhook/forward.go`).
        let channel = try await sockets.open(
            WebSocketRequest(url: url, headers: ["Authorization": grant.accessToken]),
        )
        return GitHubForwarderWatch(channel: channel)
    }

    /// What makes the hook a forwarder rather than an ordinary webhook: the name `cli`, and a
    /// config with no `url` in it. A hook created any other way gets no `ws_url`.
    private static func creating() throws -> Data {
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        return try encoder.encode(Creating())
    }

    private struct Creating: Encodable {
        let name = "cli"
        let active = true
        /// The one event a Delivery is derived from. A hook subscribed to more would wake the
        /// derivation for things no roster row draws.
        let events = ["pull_request"]
        let config: [String: String] = [:]
    }
}

/// One open forwarder socket, and the acknowledgement every delivery down it is owed.
actor GitHubForwarderWatch: DeliveryWatch {
    private let channel: any WebSocketChannel

    init(channel: any WebSocketChannel) {
        self.channel = channel
    }

    /// The forwarder's own acknowledgement shape, upper-case where the delivery it answers is
    /// lower-case (`cli/gh-webhook`, `webhook/forward.go`). It never varies, so it is one constant
    /// rather than an encode per frame. Unacknowledged deliveries are redelivered; acknowledged
    /// ones arrived exactly once across a 50-second measurement (#1579).
    private static let acknowledgement = Data(#"{"Status":200,"Header":{},"Body":""}"#.utf8)

    /// Every frame is acknowledged; only a `pull_request` is a move. The forwarder opens each
    /// socket with a `ping` of its own, which carries no pull request and must not derive.
    func nextMove() async throws {
        while true {
            let frame = try await channel.receive()
            try await channel.send(Self.acknowledgement)
            guard let delivery = try? GitHubCall.decoder.decode(
                GitHubForwarderFrame.self, from: frame,
            )
            else { continue }
            if delivery.event == "pull_request" {
                return
            }
        }
    }

    func close() async {
        await channel.close()
    }
}
