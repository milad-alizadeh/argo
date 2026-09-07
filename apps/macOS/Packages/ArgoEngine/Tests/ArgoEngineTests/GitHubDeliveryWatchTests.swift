@testable import ArgoEngine
import Foundation
import Testing

/// GitHub's webhook forwarder read as a port (#1579): what makes the hook a forwarder, what the
/// socket is dialled with, and which frames down it are a move.
///
/// Nothing here opens a real connection or creates a real hook — the HTTP transport and the socket
/// are both scripted.
@Suite("GitHub delivery watch")
struct GitHubDeliveryWatchTests {
    private static let hook = #"{"id": 1, "ws_url": "wss://webhook-forwarder.github.com/forward"}"#

    /// One frame as the forwarder writes it: lower-case fields, and a header mapping each name to
    /// every value it was sent with.
    private static func frame(_ event: String) -> Data {
        Data(#"{"header": {"X-Github-Event": ["\#(event)"]}, "delivery_id": "d1"}"#.utf8)
    }

    private struct Watching {
        let watch: GitHubDeliveryWatch
        let github: RecordedGitHub
        let sockets: ScriptedSockets

        init(hook: String = GitHubDeliveryWatchTests.hook, frames: [Data] = []) {
            self.github = RecordedGitHub(replies: ["hooks": hook])
            self.sockets = ScriptedSockets(frames: frames)
            self.watch = GitHubDeliveryWatch(transport: github, sockets: sockets)
        }
    }

    @Test
    func `the hook it creates is a forwarder rather than an ordinary webhook`() async throws {
        // `name: cli` and a config with no `url` are what earn a `ws_url`. A hook created any other
        // way gets none, and the socket has nothing to dial.
        let watching = Watching()

        _ = try await watching.watch.open("acme/api", grant: .listing)

        let write = try #require(await watching.github.writes().first)
        #expect(write.method == .post)
        #expect(write.path == "/repos/acme/api/hooks")
        #expect(write.field("name") == "cli")
        #expect(write.field("events") == #"["pull_request"]"#)
        #expect(write.field("config") == "{}")
    }

    @Test
    func `the socket is dialled with the raw token rather than a bearer one`() async throws {
        // The forwarder takes the token unprefixed, which is not what any of GitHub's HTTP
        // endpoints take (`cli/gh-webhook`, `webhook/forward.go`).
        let watching = Watching()

        _ = try await watching.watch.open("acme/api", grant: .listing)

        let dialled = try #require(await watching.sockets.lastRequest())
        #expect(dialled.url == "wss://webhook-forwarder.github.com/forward")
        #expect(dialled.headers["Authorization"] == AccountGrant.listing.accessToken)
    }

    @Test
    func `a hook that answered with no socket to dial opens nothing`() async {
        // The forwarder belongs to a CLI preview GitHub can withdraw without notice, and the day it
        // does the poll is what carries the roster.
        let watching = Watching(hook: #"{"id": 1}"#)

        await #expect(throws: (any Error).self) {
            _ = try await watching.watch.open("acme/api", grant: .listing)
        }
        #expect(await watching.sockets.lastRequest() == nil)
    }

    @Test
    func `the ping the forwarder opens with is not a move`() async throws {
        // Every socket opens with one, and deriving on it would spend a read on the hook's own
        // activation.
        let watching = Watching(frames: [Self.frame("ping"), Self.frame("pull_request")])

        let opened = try await watching.watch.open("acme/api", grant: .listing)
        try await opened.nextMove()

        // The pull request was the FIRST move, so the ping was read and passed over rather than
        // counted — and with both frames spent, there is no second move to be had.
        await #expect(throws: (any Error).self) {
            try await opened.nextMove()
        }
    }

    @Test
    func `every frame is acknowledged, the one that is not a move included`() async throws {
        // An unacknowledged delivery is redelivered; an acknowledged one arrives exactly once.
        let watching = Watching(frames: [Self.frame("ping"), Self.frame("pull_request")])

        let opened = try await watching.watch.open("acme/api", grant: .listing)
        try await opened.nextMove()

        let sent = await watching.sockets.sent()
        #expect(sent.count == 2)
        for acknowledgement in sent {
            let read = try JSONSerialization.jsonObject(with: acknowledgement) as? [String: Any]
            #expect(read?["Status"] as? Int == 200)
        }
    }

    @Test
    func `a watch that is closed closes the socket under it`() async throws {
        // The socket is what GitHub reaps the hook on, so one left open outlives the Project.
        let watching = Watching(frames: [Self.frame("pull_request")])

        let opened = try await watching.watch.open("acme/api", grant: .listing)
        await opened.close()

        #expect(await watching.sockets.closed() == 1)
    }
}
