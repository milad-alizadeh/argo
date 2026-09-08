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
/// The reap is not instant, though, so a dial can land while the previous hook is still there and
/// be refused for it. `open` deletes that hook and creates again (#1697).
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
        var created = try await createHook(on: scope, grant: grant)
        if let refusal = Self.refusal(in: created) {
            // Once, and no further: a repository that refuses the second create is holding
            // something this cannot clear, and the poll carries the roster meanwhile.
            guard refusal.isHookAlreadyHeld else { throw DeliveryWatchRefusal.noSocketOffered }
            try await deleteHeldHook(on: scope, grant: grant)
            created = try await createHook(on: scope, grant: grant)
        }
        let hook = try? GitHubCall.decoder.decode(GitHubForwarderHook.self, from: created)
        guard let url = hook?.wsUrl else { throw DeliveryWatchRefusal.noSocketOffered }
        // The RAW token, with no `Bearer` prefix — which is not what any of GitHub's HTTP endpoints
        // take (`cli/gh-webhook`, `webhook/forward.go`).
        let channel = try await sockets.open(
            WebSocketRequest(url: url, headers: ["Authorization": grant.accessToken]),
        )
        return GitHubForwarderWatch(channel: channel)
    }

    /// What the host said instead of a hook, where that is what it said. Read before the body is
    /// read as a hook, because `wsUrl` is optional and an error body decodes as a valid hook
    /// offering no socket otherwise — a dial refused for a reason nothing downstream can act on
    /// (#1697).
    private static func refusal(in created: Data) -> GitHubFailure? {
        try? GitHubCall.decoder.decode(GitHubFailure.self, from: created)
    }

    private func createHook(on scope: String, grant: AccountGrant) async throws -> Data {
        try await call.send(
            Self.hooks(on: scope), method: .post, body: Self.creating(), grant: grant,
        )
    }

    /// The `cli` hook the repository is still holding, deleted by the id its own listing gives —
    /// the refusal names no id, and GitHub has no delete keyed by a hook's name.
    ///
    /// Every way this can fail — a listing that did not land, a listing holding no forwarder hook,
    /// a delete the host refused — throws `noSocketOffered`, which is the reading the create's own
    /// refusal had before there was a recovery to fail. So a recovery that cannot finish leaves the
    /// health ledger exactly where an unrecovered 422 used to leave it, and no worse.
    ///
    /// A listing with no forwarder hook in it is one of those: a repository keeps every webhook
    /// somebody else set up, so only `cli` is ever deleted.
    private func deleteHeldHook(on scope: String, grant: AccountGrant) async throws {
        guard let listed = try? await call.send(Self.hooks(on: scope), grant: grant),
              let held = try? GitHubCall.decoder.decode([Held].self, from: listed),
              let forwarder = held.first(where: { $0.name == Self.forwarderName })
        else { throw DeliveryWatchRefusal.noSocketOffered }
        let deleted = try? await call.send(
            "\(Self.hooks(on: scope))/\(forwarder.id)", method: .delete, grant: grant,
        )
        guard deleted != nil else { throw DeliveryWatchRefusal.noSocketOffered }
    }

    private static func hooks(on scope: String) -> String {
        "/repos/\(scope)/hooks"
    }

    /// GitHub's own name for the forwarder's hook. It is what earns a `ws_url`, and what tells the
    /// hook Argo made from the webhooks somebody else set up.
    private static let forwarderName = "cli"

    /// One row of the repository's own hook listing, read for the delete: the id it is keyed by and
    /// the name that says whose hook it is. Both are on every row of
    /// `GET /repos/milad-alizadeh/argo/hooks`, measured 2026-09-08 (#1697).
    private struct Held: Decodable {
        let id: Int
        let name: String
    }

    /// What makes the hook a forwarder rather than an ordinary webhook: the name `cli`, and a
    /// config with no `url` in it. A hook created any other way gets no `ws_url`.
    private static func creating() throws -> Data {
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        return try encoder.encode(Creating())
    }

    private struct Creating: Encodable {
        let name = GitHubDeliveryWatch.forwarderName
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
