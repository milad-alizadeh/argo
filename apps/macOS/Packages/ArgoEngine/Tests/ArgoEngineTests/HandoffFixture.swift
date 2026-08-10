@testable import ArgoEngine
import Foundation

/// A host that answers a handoff's acts without a PTY, a CLI or a clock — so what is under test is
/// the ORDER they happen in and what happens when one of them refuses.
@MainActor
final class FakeHandoffHost: HandoffHost {
    private(set) var typed: [(sessionID: String, text: String)] = []
    private(set) var seeds: [SessionSeed] = []
    /// What `steer` answers. `false` is the external/orphaned Session — no prompt to type at.
    var isSteerable = true
    /// The brief, once something puts it there. Absent until then, which is the wait's whole
    /// subject.
    var briefs: [String: String] = [:]
    var spawnFailure: AgentSpawnError?
    /// The chain the handoff recorded, in the order it recorded it.
    private(set) var chained: [(sessionID: String, fresh: String)] = []
    /// Run on every pause, so a test can make the brief arrive on the second look rather than
    /// racing a real file system.
    var onPause: () -> Void = {}

    func steer(sessionID: String, typing text: String) -> Bool {
        guard isSteerable else { return false }
        typed.append((sessionID, text))
        return true
    }

    func brief(at path: String) -> String? {
        briefs[path]
    }

    func spawn(_ seed: SessionSeed) async throws -> String {
        if let spawnFailure {
            throw spawnFailure
        }
        seeds.append(seed)
        return "fresh-session"
    }

    func handedOff(sessionID: String, to fresh: String) {
        chained.append((sessionID, fresh))
    }
}

/// A clock the test moves by hand. A twenty-minute limit is then reached in as many microseconds as
/// it takes to loop, which is what makes the timeout a rule rather than one nothing ever exercises.
@MainActor
final class HandoffTestClock {
    var nowMs = 1_000_000
}

/// One handoff, wired to the fake host and the hand-moved clock — its own file beside the suites
/// that use it, exactly as `SpawnFixture` is: two suites read it now, and a fixture nested inside
/// one of them is a fixture the other has to reach into a suite for.
@MainActor
final class HandoffFixture {
    let host: FakeHandoffHost
    let root: URL
    let handoff: SessionHandoff

    let request = SessionHandoff.Request(
        sessionID: "full-session",
        cwd: "/Users/milad/Developer/argo",
        issue: 513,
    )

    init(patience: HandoffPatience = .default) {
        let host = FakeHandoffHost()
        let clock = HandoffTestClock()
        let root = URL(fileURLWithPath: NSTemporaryDirectory())
            .appending(path: "argo-handoff-\(UUID().uuidString.prefix(8))")
        self.host = host
        self.root = root
        self.handoff = SessionHandoff(
            host: host,
            root: root,
            wait: HandoffWait(
                patience: patience,
                now: { clock.nowMs },
                pause: { milliseconds in
                    clock.nowMs += milliseconds
                    host.onPause()
                },
            ),
        )
    }

    /// The brief `/handoff` was asked to write, at the path Argo named in the command.
    func writeBrief(_ text: String) {
        guard let typed = host.typed.last?.text else { return }
        host.briefs[String(typed.dropFirst("/handoff ".count)
                .trimmingCharacters(in: .whitespacesAndNewlines))] = text
    }

    func writeBriefOnce() {
        writeBrief("# Where this got to\n\nThe branch is green.")
    }

    func remove() {
        try? FileManager.default.removeItem(at: root)
    }
}
