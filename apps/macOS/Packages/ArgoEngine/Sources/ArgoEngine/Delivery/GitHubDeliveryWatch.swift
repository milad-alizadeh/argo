import Foundation

/// The code host's live channel, filled by GitHub's webhook forwarder.
///
/// GitHub runs a forwarder that removes the need for the public endpoint a desktop app has never
/// had: `POST /repos/{scope}/hooks` with `"name": "cli"` and no `config.url` answers with a
/// `ws_url`
/// to dial, and each delivery arrives down that socket in well under a second (#1579).
///
/// The hook is ephemeral: GitHub reaps it within two seconds of the socket dropping, a clean close
/// and a killed process alike. So it cannot leak, it cannot outlive the Project that made it, and
/// there is never a second one to reuse — which is also why the grant needs no `admin:repo_hook`,
/// the scope only list, read and delete demand.
///
/// Those two seconds are the one thing that reasoning does not cover, because a dial can land
/// inside them. `open` deletes the hook the repository is still holding when it does (#1697).
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
        let created = try await create(on: scope, grant: grant)
        let hook = try? GitHubCall.decoder.decode(GitHubForwarderHook.self, from: created)
        guard let url = hook?.wsUrl else { throw DeliveryWatchRefusal.noSocketOffered }
        // The RAW token, with no `Bearer` prefix — which is not what any of GitHub's HTTP endpoints
        // take (`cli/gh-webhook`, `webhook/forward.go`).
        let channel = try await sockets.open(
            WebSocketRequest(url: url, headers: ["Authorization": grant.accessToken]),
        )
        return GitHubForwarderWatch(channel: channel)
    }

    /// The create, and the one refusal it clears rather than reports: a dial inside the reap window
    /// is answered `422 Hook already exists on this repository`, which deleting the held hook
    /// clears. Read as a failure before it is read as a hook, because the error body decodes as a
    /// valid hook offering no socket otherwise.
    ///
    /// The create is sent once more and no further: a repository that refuses the second one is
    /// holding something Argo cannot clear, and the poll carries the roster meanwhile.
    private func create(on scope: String, grant: AccountGrant) async throws -> Data {
        let created = try await posting(on: scope, grant: grant)
        guard let failure = try? GitHubCall.decoder.decode(GitHubFailure.self, from: created),
              failure.isHookAlreadyHeld
        else { return created }
        try await deleteHeldHook(on: scope, grant: grant)
        return try await posting(on: scope, grant: grant)
    }

    private func posting(on scope: String, grant: AccountGrant) async throws -> Data {
        try await call.send(
            "/repos/\(scope)/hooks", method: .post, body: Self.creating(), grant: grant,
        )
    }

    /// The `cli` hook the repository is still holding, deleted by the id its own listing gives.
    /// Nothing is deleted where the listing holds no forwarder hook: a repository holding webhooks
    /// somebody else set up keeps every one of them.
    private func deleteHeldHook(on scope: String, grant: AccountGrant) async throws {
        let listed = try await call.send("/repos/\(scope)/hooks", grant: grant)
        let held = try? GitHubCall.decoder.decode([GitHubForwarderHook].self, from: listed)
        guard let forwarder = held?.first(where: { $0.name == Creating.forwarder }) else { return }
        _ = try await call.send(
            "/repos/\(scope)/hooks/\(forwarder.id)", method: .delete, grant: grant,
        )
    }

    /// What makes the hook a forwarder rather than an ordinary webhook: the name `cli`, and a
    /// config with no `url` in it. A hook created any other way gets no `ws_url`.
    private static func creating() throws -> Data {
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        return try encoder.encode(Creating())
    }

    private struct Creating: Encodable {
        /// GitHub's own name for the forwarder's hook, which is both what earns a `ws_url` and what
        /// finds the hook again in the repository's listing.
        static let forwarder = "cli"

        let name = Creating.forwarder
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
