@testable import ArgoEngine
import Foundation
import Testing

/// How a Session's process was started, off the CLI's own `entrypoint` (`CONTEXT.md` L2 · Entry).
///
/// The shapes are verbatim from `claude` 2.1.250: every message-bearing record carries the field,
/// `sdk-cli` on a `claude -p` run and `cli` on one somebody is sitting at.
@Suite("Entry reading")
struct EntryReadingTests {
    private func words(_ events: [TranscriptEvent]) -> [String] {
        events.compactMap { event in
            guard case let .entry(cli) = event else { return nil }
            return cli
        }
    }

    private func line(entrypoint: String?) -> String {
        let field = entrypoint.map { "\"entrypoint\": \"\($0)\", " } ?? ""
        return """
        {"type": "user", "message": {"role": "user", "content": "hi"}, "uuid": "u", \
        \(field)"cwd": "/tmp/argo", "sessionId": "s"}
        """
    }

    @Test
    func `the CLI's own word is read verbatim`() async {
        let read = await words(TranscriptReader().read(line: line(entrypoint: "sdk-cli")))

        // Verbatim and unread, like the stance beside it: what the word MEANS is `SessionEntry`'s.
        #expect(read == ["sdk-cli"])
    }

    /// The cwd's rule, and for the cwd's reason: a file's entrypoint is settled when it is opened,
    /// and re-announcing it once per record would bury every event anybody is watching for.
    @Test
    func `the word is announced on its first reading only`() async {
        let reader = TranscriptReader()
        let lines = [line(entrypoint: "cli"), line(entrypoint: "cli")]

        let read = await words(reader.read(lines: lines))

        #expect(read == ["cli"])
    }

    @Test
    func `a record carrying no entrypoint announces none`() async {
        let read = await words(TranscriptReader().read(line: line(entrypoint: nil)))

        #expect(read.isEmpty)
    }

    @Test
    func `a headless run reads headless`() {
        #expect(SessionEntry(entrypoint: "sdk-cli") == .headless)
    }

    /// Degrade-down, and the one rule in this file that matters (`CONTEXT.md` Honesty tier). The
    /// two errors are not symmetric: reading a headless run as interactive costs a Roster row,
    /// and reading an interactive one as headless folds a Session somebody is steering out of
    /// sight. So everything Argo cannot vouch for resolves to `interactive`.
    @Test(arguments: [nil, "cli", "sdk", "sdk-cli-v2", "", "SDK-CLI"])
    func `anything Argo does not recognise reads interactive`(word: String?) {
        #expect(SessionEntry(entrypoint: word) == .interactive)
    }

    @Test
    @MainActor
    func `a Session's Entry is what its records reported`() async throws {
        let hub = testHub(projectURL: URL(fileURLWithPath: "/tmp/argo-entry"))
        let observed = hubTestObservation(id: "session", events: [.entry(cli: "sdk-cli")])

        await hubObserveToEnd(hub, observed)

        #expect(try #require(hub.sessions.first).entry == .headless)
    }

    /// The unread Session, which is most of them at launch: no record has said anything about an
    /// entrypoint, and the quiet reading is the drivable one.
    @Test
    @MainActor
    func `a Session no record said anything about is interactive`() async throws {
        let hub = testHub(projectURL: URL(fileURLWithPath: "/tmp/argo-entry-quiet"))
        let observed = hubTestObservation(id: "session", events: [
            .prompt(text: "hi", images: [], atMs: 1000),
        ])

        await hubObserveToEnd(hub, observed)

        #expect(try #require(hub.sessions.first).entry == .interactive)
    }

    /// A chain is headless only where EVERY link is (`CONTEXT.md` L2 · Entry). A resume opened at
    /// a terminal continues the work a `-p` run started, and what is happening to it NOW is the
    /// fact the Roster draws.
    @Test
    func `a chain resumed at a terminal is interactive, whatever it continues`() {
        var root = HubSession(observation: hubTestObservation(id: "root", events: []))
        root.apply(.entry(cli: "sdk-cli"))
        var resumed = HubSession(observation: hubTestObservation(id: "resumed", events: []))
        resumed.apply(.entry(cli: "cli"))

        root.mergeContinuation(resumed)

        #expect(root.entry == .interactive)
    }

    @Test
    func `a chain headless end to end stays headless`() {
        var root = HubSession(observation: hubTestObservation(id: "root", events: []))
        root.apply(.entry(cli: "sdk-cli"))
        var resumed = HubSession(observation: hubTestObservation(id: "resumed", events: []))
        resumed.apply(.entry(cli: "sdk-cli"))

        root.mergeContinuation(resumed)

        #expect(root.entry == .headless)
    }
}
