@testable import ArgoEngine
import Foundation
import Testing

/// The dial that lands inside GitHub's reap window (#1697): the previous `cli` hook is still on the
/// repository, the create is refused for it, and `open` clears that itself rather than reporting a
/// code host nothing could reach.
///
/// Nothing here opens a real connection or creates a real hook — the HTTP transport and the socket
/// are both scripted.
///
/// Bounded, because the ledger case waits for a derivation the socket is meant to raise: a
/// regression that stops it would otherwise hang the Swift gate rather than refuse the push.
@Suite("GitHub forwarder reap window", .timeLimit(.minutes(1)))
struct GitHubForwarderReapTests {
    /// GitHub's own refusal, measured against `milad-alizadeh/argo` on 2026-09-07 (#1697). The
    /// top-level message names nothing; the per-field complaint is what says the hook is still
    /// there.
    private static let stillHeld = #"""
    {"message":"Validation Failed","errors":[{"resource":"Hook","code":"custom",
     "message":"Hook already exists on this repository"}],"status":"422"}
    """#

    private static let created = #"""
    {"id": 675934364, "name": "cli", "ws_url": "wss://webhook-forwarder.github.com/forward"}
    """#

    /// The listing the repository answers while it is still holding the hook, carrying the id the
    /// refusal names nowhere.
    private static let holding = #"[{"id": 675807566, "name": "cli", "active": true}]"#

    private struct Dialling {
        let watch: GitHubDeliveryWatch
        let github: ScriptedGitHubHooks
        let sockets: ScriptedSockets

        init(
            creates: [String] = [
                GitHubForwarderReapTests.stillHeld, GitHubForwarderReapTests.created,
            ],
            holding: String = GitHubForwarderReapTests.holding,
            refusing: Set<HTTPMethod> = [],
        ) {
            self.github = ScriptedGitHubHooks(
                creates: creates, holding: holding, refusing: refusing,
            )
            self.sockets = ScriptedSockets()
            self.watch = GitHubDeliveryWatch(transport: github, sockets: sockets)
        }
    }

    @Test
    func `a create refused because the hook is still held deletes it and creates once more`(
    ) async throws {
        let dialling = Dialling()

        _ = try await dialling.watch.open("acme/api", grant: .listing)

        // The socket the second create earned, which is the outcome: the dial opened.
        #expect(await dialling.sockets.lastRequest()?.url
            == "wss://webhook-forwarder.github.com/forward")
        let writes = await dialling.github.requests().writes
        #expect(writes.map(\.method) == [.post, .delete, .post])
        #expect(writes[1].path == "/repos/acme/api/hooks/675807566")
        #expect(writes[2].field("name") == "cli")
    }

    @Test
    func `a recovered dial leaves the code host healthy rather than unreachable`() async {
        // The defect the ticket is about: the chip read `GitHub · just now · unreachable` off a
        // dial while every read through the Binding was landing. A recovered create reports no dial
        // failure, so the ledger holds what the derivation put there and nothing else.
        let health = ConnectionHealthLedger()
        let target = PortReadTarget.codeHost()
        let derivation = DeliveryDerivation(
            port: ScriptedCodeHost([.success([])]), health: health, deliveries: DeliveryLedger(),
        )
        let derivations = SocketDerivations()
        let dialling = Dialling()
        let socket = DeliverySocket(
            watch: dialling.watch,
            derive: { read in
                await derivation.derive(read, locally: .init(workspaces: []))
                await derivations.derive(read)
            },
            reportDialFailure: { read, error in await derivation.dialFailed(read, error: error) },
        )

        await socket.point(.ready(target.binding), at: "P1")
        await derivations.untilDerived(1)
        await socket.stop()

        #expect(await health.health(of: target.projectBinding, in: "P1").state == .healthy)
        #expect(await dialling.github.requests().writes.map(\.method) == [.post, .delete, .post])
    }

    @Test
    func `the hook deleted is the forwarder's own, not an ordinary webhook the repository keeps`(
    ) async throws {
        // A repository may hold webhooks somebody else set up, and deleting one of those would
        // break a service Argo knows nothing about.
        let dialling = Dialling(
            holding: #"[{"id": 111, "name": "web"}, {"id": 675807566, "name": "cli"}]"#,
        )

        _ = try await dialling.watch.open("acme/api", grant: .listing)

        let deletes = await dialling.github.requests().writes.filter { $0.method == .delete }
        #expect(deletes.map(\.path) == ["/repos/acme/api/hooks/675807566"])
    }

    @Test
    func `the create is retried once, so a repository that keeps refusing still reaches the poll`(
    ) async {
        // A second refusal is not recovered from again: the delete landed and the create still
        // would not, so whatever holds that hook is not something this can clear.
        let dialling = Dialling(creates: [Self.stillHeld])

        await #expect(throws: DeliveryWatchRefusal.noSocketOffered) {
            _ = try await dialling.watch.open("acme/api", grant: .listing)
        }
        #expect(await dialling.github.requests().writes.map(\.method) == [.post, .delete, .post])
    }

    @Test
    func `a delete the host refuses reads as no socket, not as a grant to sign in again`(
    ) async {
        // The recovery's own requests are not reads of the port. A 403 on the delete reported as
        // `grantRefused` is the very misreading the ticket names: a reader who has just signed in
        // sees the chip say so and reads it as a login that did not take.
        let dialling = Dialling(refusing: [.delete])

        await #expect(throws: DeliveryWatchRefusal.noSocketOffered) {
            _ = try await dialling.watch.open("acme/api", grant: .listing)
        }
    }

    @Test
    func `a repository holding no forwarder hook is asked to delete nothing`() async {
        // The hook was reaped between the refusal and the listing, so there is nothing to clear and
        // no second create worth sending.
        let dialling = Dialling(holding: "[]")

        await #expect(throws: DeliveryWatchRefusal.noSocketOffered) {
            _ = try await dialling.watch.open("acme/api", grant: .listing)
        }
        #expect(await dialling.github.requests().writes.map(\.method) == [.post])
    }

    @Test
    func `a create refused for any other reason is read as it was before, and deletes nothing`(
    ) async {
        // Only the held hook is a state this can fix. Every other refusal is still the host
        // answering with no socket, which is what the poll carries the roster through.
        let dialling = Dialling(creates: [#"{"message": "Not Found"}"#])

        await #expect(throws: DeliveryWatchRefusal.noSocketOffered) {
            _ = try await dialling.watch.open("acme/api", grant: .listing)
        }
        #expect(await dialling.github.requests().count == 1)
    }

    @Test
    func `a create that lands deletes nothing and asks for no listing`() async throws {
        // The ordinary dial, unchanged: one request, and the repository is never read.
        let dialling = Dialling(creates: [Self.created])

        _ = try await dialling.watch.open("acme/api", grant: .listing)

        #expect(await dialling.github.requests().count == 1)
    }
}
