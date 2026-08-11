@testable import ArgoEngine
import Foundation

/// What a live handoff needs on top of a live Session: this repo's own skill in the Project, a
/// place for the brief, and a wait that keeps the permission gate serviced while the agent works.
@MainActor
extension LiveClaudeFixture {
    /// Where briefs land in a live run: the fixture's own folder, standing in for `Hub.handoffRoot`
    /// so a test never writes to the machine's real application support.
    var briefRoot: URL {
        root.appending(path: "handoffs", directoryHint: .isDirectory)
    }

    /// The roster's id for the Session under test. It is the claim's own until the CLI writes a
    /// record and the row is re-keyed, which is why it is read at the moment it is used.
    var sessionID: String? {
        hub.sessions.first?.id
    }

    /// A handoff whose wait yields instead of sleeping, and answers the gate while it waits.
    ///
    /// Both halves are the same fact: the gate's socket is read by a dispatch source on the main
    /// queue (see `settle`), so `HandoffWait`'s own `Task.sleep` would leave the CLI blocked on a
    /// permission nobody can hear. Allowing what is pending is the person at the cockpit — writing
    /// the brief is a Write outside the Project and the agent asks before it does it.
    ///
    /// `namingTheBriefAtMs` fixes the ONE reading of the clock the brief's filename is taken from,
    /// so a test can put a file at that address before the agent gets there. Every later reading is
    /// the real clock, or the deadline would never be reached and the wait would never end.
    func handoff(patience: HandoffPatience, namingTheBriefAtMs fixed: Int? = nil)
        -> SessionHandoff {
        var readings = 0
        return SessionHandoff(
            host: hub,
            root: briefRoot,
            wait: HandoffWait(
                patience: patience,
                now: {
                    readings += 1
                    guard let fixed, readings == 1 else { return Date().epochMs }
                    return fixed
                },
                pause: { [self] milliseconds in
                    allowPendingPermissions()
                    await yielding(milliseconds: milliseconds)
                },
            ),
        )
    }

    /// Where a handoff started with `namingTheBriefAtMs` will look for its brief.
    func briefURL(forSessionID sessionID: String, atMs: Int) -> URL {
        HandoffScript.briefURL(in: briefRoot, sessionID: sessionID, atMs: atMs)
    }

    /// A pause of the length asked for that keeps the main queue turning — `settle`'s rule, in the
    /// milliseconds `HandoffPatience` is written in.
    func yielding(milliseconds: Int) async {
        let deadline = ContinuousClock.now + .milliseconds(milliseconds)
        while ContinuousClock.now < deadline {
            await Task.yield()
        }
    }

    /// One Turn put to the Session and seen through to the CLI's answer.
    ///
    /// The wait is on the CLI's own record and not on the roster's status, because the two failure
    /// modes both read as "ready". A row that has not started yet is already `idle`, and a row the
    /// Hub has not observed yet is not there at all — either way a status-only wait returns the
    /// instant the bytes are written, the next thing typed joins the same composer line, and two
    /// Turns arrive as one. An answer that is ON DISK happened.
    func askAndSettle(_ prompt: String) async throws {
        let before = recordSize(of: nil)
        try ask(prompt)
        await settleAllowing(seconds: 300) { self.recordSize(of: nil) > before }
        await settleTurn(of: nil)
    }

    /// The same, put to a Session by name rather than to this fixture's own claim.
    func sendAndSettle(_ prompt: String, to sessionID: String) async throws {
        let before = recordSize(of: sessionID)
        try hub.driver.send(prompt, to: sessionID)
        await settleAllowing(seconds: 300) { self.recordSize(of: sessionID) > before }
        await settleTurn(of: sessionID)
    }

    /// Wait out the Turn a Session is in the middle of.
    ///
    /// A seeded spawn is already answering when it is handed back — its opening prompt was a
    /// launch argument — so anything typed at it before this lands INSIDE that turn as keystrokes
    /// rather than arriving as a Turn of its own.
    func settleTurn(of sessionID: String?) async {
        await settleAllowing(seconds: 60) { self.row(sessionID)?.status == .running }
        await settleAllowing(seconds: 300) { self.row(sessionID)?.status == .idle }
    }

    /// How much record the CLI has written for a Session. Zero before its first prompt — the file
    /// does not exist until then — and larger after every Turn it takes.
    private func recordSize(of sessionID: String?) -> Int {
        guard let url = row(sessionID)?.sourceURL,
              let size = try? FileManager.default
              .attributesOfItem(atPath: url.path)[.size] as? Int
        else { return 0 }
        return size
    }

    /// A named row, or this fixture's own Session when no name is given.
    private func row(_ sessionID: String?) -> HubSession? {
        guard let sessionID else { return hub.sessions.first }
        return hub.sessions.first { $0.id == sessionID }
    }

    /// Say yes to every Permission any Session of this fixture is blocked on.
    func allowPendingPermissions() {
        for session in hub.sessions {
            guard let request = session.permission else { continue }
            try? hub.driver.decide(.allow, answering: request.id, for: session.id)
        }
    }

    /// Yield until a condition holds, answering the gate on the way. The plain `settle` is enough
    /// for a test that answers its own Permission; a handoff has turns of work behind it.
    func settleAllowing(seconds: Int, until condition: () -> Bool) async {
        await settle(seconds: seconds) {
            allowPendingPermissions()
            return condition()
        }
    }

    /// This repo's skills, copied into the Project's own `.claude/skills`. Copied rather than
    /// symlinked because the CLI resolves the folder it is given, and a test that followed a link
    /// out of its temp Project would be reading the developer's checkout at run time.
    static func install(skills: [String], into root: URL) throws {
        guard !skills.isEmpty else { return }
        let source = try repositoryRoot().appending(path: ".agents/skills")
        let destination = root.appending(path: ".claude/skills", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: destination, withIntermediateDirectories: true)
        for skill in skills {
            try FileManager.default.copyItem(
                at: source.appending(path: skill, directoryHint: .isDirectory),
                to: destination.appending(path: skill, directoryHint: .isDirectory),
            )
        }
    }

    /// The checkout this test file is part of, found by walking up from it. Located by a folder
    /// only the root has, so a file moved between targets does not silently read the wrong tree
    /// the way a fixed number of `..` would.
    private static func repositoryRoot(from file: String = #filePath) throws -> URL {
        var directory = URL(fileURLWithPath: file).deletingLastPathComponent()
        while directory.path != "/" {
            if FileManager.default.fileExists(atPath: directory.appending(path: ".agents").path) {
                return directory
            }
            directory = directory.deletingLastPathComponent()
        }
        throw LiveFixtureError.noRepositoryRoot(from: file)
    }
}

enum LiveFixtureError: Error {
    case noRepositoryRoot(from: String)
}
