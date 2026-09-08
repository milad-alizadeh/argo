@testable import ArgoEngine
import Foundation
import Testing

/// The dial that lands inside GitHub's reap window (#1697): the previous `cli` hook is still on the
/// repository, the create is answered `422`, and `open` clears that itself rather than reporting a
/// code host nothing could reach.
///
/// Nothing here opens a real connection or creates a real hook — the HTTP transport and the socket
/// are both scripted.
@Suite("GitHub forwarder reap window")
struct GitHubForwarderReapTests {
    /// GitHub's own 422, measured against `milad-alizadeh/argo` on 2026-09-07 (#1697). The
    /// top-level message names nothing; the per-field complaint is what says the hook is still
    /// there.
    private static let stillHeld = #"""
    {"message":"Validation Failed","errors":[{"resource":"Hook","code":"custom",
     "message":"Hook already exists on this repository"}],"status":"422"}
    """#

    private static let created = #"""
    {"id": 675934364, "name": "cli", "ws_url": "wss://webhook-forwarder.github.com/forward"}
    """#

    /// The listing the repository answers while it still holds the hook, with the id the 422 names
    /// nowhere.
    private static let holding = #"[{"id": 675807566, "name": "cli", "active": true}]"#

    private struct Dialling {
        let watch: GitHubDeliveryWatch
        let github: ReapingGitHub
        let sockets: ScriptedSockets

        init(
            creates: [String] = [
                GitHubForwarderReapTests.stillHeld, GitHubForwarderReapTests.created,
            ],
            holding: String = GitHubForwarderReapTests.holding,
        ) {
            self.github = ReapingGitHub(creates: creates, holding: holding)
            self.sockets = ScriptedSockets()
            self.watch = GitHubDeliveryWatch(transport: github, sockets: sockets)
        }
    }

    @Test
    func `a create refused because the hook is still held deletes it and creates once more`(
    ) async throws {
        // The whole defect: this dial opens a socket, so nothing throws, so `DeliverySocket` has no
        // dial failure to report and the health ledger never hears the word unreachable.
        let dialling = Dialling()

        _ = try await dialling.watch.open("acme/api", grant: .listing)

        let writes = await dialling.github.writes()
        #expect(writes.map(\.method) == [.post, .delete, .post])
        #expect(writes[1].path == "/repos/acme/api/hooks/675807566")
        #expect(writes[2].field("name") == "cli")
        #expect(await dialling.sockets.lastRequest()?.url
            == "wss://webhook-forwarder.github.com/forward")
    }

    @Test
    func `the hook deleted is the forwarder's own, not an ordinary webhook the repository keeps`(
    ) async throws {
        // A repository may hold webhooks somebody else set up, and deleting one of those would
        // break a service Argo knows nothing about. Only `cli` is the forwarder's.
        let dialling = Dialling(
            holding: #"[{"id": 111, "name": "web"}, {"id": 675807566, "name": "cli"}]"#,
        )

        _ = try await dialling.watch.open("acme/api", grant: .listing)

        let deletes = await dialling.github.writes().filter { $0.method == .delete }
        #expect(deletes.map(\.path) == ["/repos/acme/api/hooks/675807566"])
    }

    @Test
    func `the create is retried once, so a repository that keeps refusing still reaches the poll`(
    ) async {
        // A second 422 is refused rather than recovered from again: the delete answered and the
        // create still would not land, so whatever holds that hook is not something Argo can clear.
        let dialling = Dialling(creates: [Self.stillHeld])

        await #expect(throws: DeliveryWatchRefusal.noSocketOffered) {
            _ = try await dialling.watch.open("acme/api", grant: .listing)
        }
        let writes = await dialling.github.writes()
        #expect(writes.map(\.method) == [.post, .delete, .post])
    }

    @Test
    func `a create refused for any other reason is read as it was before, and deletes nothing`(
    ) async {
        // Only the held hook is a state Argo can fix. Every other refusal is still the host
        // answering with no socket, which is what the poll carries the roster through.
        let dialling = Dialling(creates: [#"{"message": "Not Found"}"#])

        await #expect(throws: DeliveryWatchRefusal.noSocketOffered) {
            _ = try await dialling.watch.open("acme/api", grant: .listing)
        }
        #expect(await dialling.github.writes().map(\.method) == [.post])
    }

    @Test
    func `a create that lands deletes nothing and asks for no listing`() async throws {
        // The ordinary dial, unchanged: one request, and the repository is never read.
        let dialling = Dialling(creates: [Self.created])

        _ = try await dialling.watch.open("acme/api", grant: .listing)

        #expect(await dialling.github.methods() == [.post])
    }
}
