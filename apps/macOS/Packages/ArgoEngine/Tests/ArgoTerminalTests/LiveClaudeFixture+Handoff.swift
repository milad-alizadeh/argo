@testable import ArgoEngine
import Foundation

/// What a live handoff needs on top of a live Session: the machine's `handoff` skill in the
/// Project, a place for the brief, and waits that keep the permission gate serviced meanwhile.
@MainActor
extension LiveClaudeFixture {
    /// How long a Turn of real work is given. A real agent answers when it answers.
    static let turnSeconds = 300

    /// Where briefs land in a live run: the fixture's own folder, standing in for `Hub.handoffRoot`
    /// so a test never writes to the machine's real application support.
    var briefRoot: URL {
        root.appending(path: "handoffs", directoryHint: .isDirectory)
    }

    /// What the roster calls this fixture's Session. The claim's own id until the CLI writes a
    /// record and the row is re-keyed, which is why it is read at the moment it is used.
    var sessionID: String {
        hub.ownership.rowID(ofClaim: claim.value)
    }

    /// A Session with one trivial Turn behind it, so a handoff has something to summarise. The
    /// caller still owns `end()`.
    static func primed(
        saying prompt: String = "Reply with just OK.",
        carryingSkills skills: [LiveSkill] = [],
    ) async throws
        -> LiveClaudeFixture {
        let live = try await spawned(carryingSkills: skills)
        try await live.askAndSettle(prompt)
        return live
    }

    /// A handoff whose wait yields instead of sleeping, and answers the gate while it waits.
    ///
    /// Both halves are the same fact: the gate's socket is read by a dispatch source on the main
    /// queue (see `settle`), so `HandoffWait`'s own `Task.sleep` would leave the CLI blocked on a
    /// permission nobody can hear. Writing the brief is a Write outside the Project, so the agent
    /// does ask.
    ///
    /// `namingTheBriefAtMs` fixes the ONE reading of the clock the brief's filename is taken from,
    /// so a test can put a file at that address first. Every later reading is the real clock, or
    /// the deadline would never be reached and the wait would never end.
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

    /// One Turn put to this fixture's own Session and seen through to the CLI's answer.
    func askAndSettle(_ prompt: String) async throws {
        try await sendAndSettle(prompt, to: sessionID)
    }

    /// One Turn put to a named Session and seen through to the CLI's answer.
    ///
    /// The wait is on the CLI's own record and not on the roster's status, because both failure
    /// modes read as "ready" there: a row that has not started yet is already `idle`, and a row
    /// the Hub has not observed is not there at all. Either way a status-only wait returns the
    /// instant the bytes are written, the next prompt joins the same composer line, and two Turns
    /// arrive as one. A record that GREW is a Turn that reached the CLI.
    func sendAndSettle(_ prompt: String, to sessionID: String) async throws {
        let before = recordSize(of: sessionID)
        try hub.driver.send(prompt, to: sessionID)
        await settleAllowing(seconds: Self.turnSeconds) { self.recordSize(of: sessionID) > before }
        await settleTurn(of: sessionID)
    }

    /// Wait out the Turn a Session is in the middle of.
    ///
    /// A seeded spawn is already answering when it is handed back — its opening prompt was a
    /// launch argument — so anything typed at it before this lands INSIDE that turn as keystrokes
    /// rather than arriving as a Turn of its own.
    func settleTurn(of sessionID: String) async {
        await settleAllowing(seconds: 60) { self.row(sessionID)?.status == .running }
        await settleAllowing(seconds: Self.turnSeconds) { self.row(sessionID)?.status == .idle }
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

    /// How much record the CLI has written for a Session. Zero before its first prompt — the file
    /// does not exist until then — and larger after every Turn it takes.
    private func recordSize(of sessionID: String) -> Int {
        guard let url = row(sessionID)?.sourceURL,
              let size = try? FileManager.default
              .attributesOfItem(atPath: url.path)[.size] as? Int
        else { return 0 }
        return size
    }

    private func row(_ sessionID: String) -> HubSession? {
        hub.sessions.first { $0.id == sessionID }
    }

    /// This machine's installed skills, copied into the Project's own `.claude/skills`. Copied
    /// rather than symlinked because the CLI resolves the folder it is given.
    static func install(skills: [LiveSkill], into root: URL) throws {
        guard !skills.isEmpty else { return }
        let source = installedSkills()
        let destination = root.appending(path: ".claude/skills", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: destination, withIntermediateDirectories: true)
        for skill in skills {
            let skillURL = destination.appending(path: skill.directory, directoryHint: .isDirectory)
            switch skill {
            case let .installed(name):
                try FileManager.default.copyItem(
                    at: source.appending(path: name, directoryHint: .isDirectory),
                    to: skillURL,
                )
            case .probe:
                try FileManager.default.createDirectory(
                    at: skillURL,
                    withIntermediateDirectories: true,
                )
                let markdown = LiveSkill.probeMarkdown(writing: markerPath(in: root))
                try Data(markdown.utf8).write(to: skillURL.appending(path: "SKILL.md"))
            }
        }
    }

    /// Where `skills add` put this machine's skills, which is the MAIN checkout and nowhere else:
    /// `.agents/` is gitignored, so a linked worktree has no copy of its own.
    ///
    /// Reached through git rather than by walking up for `.agents`, which from a worktree climbs
    /// past the worktree's own root and lands in whatever tree happens to sit above it. A missing
    /// skill then fails at the copy, naming the path it looked in.
    private static func installedSkills(from file: String = #filePath) -> URL {
        var directory = URL(fileURLWithPath: file).deletingLastPathComponent()
        while directory.path != "/" {
            let git = directory.appending(path: ".git")
            if FileManager.default.fileExists(atPath: git.path) {
                return checkout(holding: git).appending(path: ".agents/skills")
            }
            directory = directory.deletingLastPathComponent()
        }
        return URL(fileURLWithPath: file).deletingLastPathComponent()
    }

    /// The checkout a `.git` belongs to. A worktree's `.git` is a FILE holding
    /// `gitdir: <main>/.git/worktrees/<name>`, so the main checkout is three components above it.
    private static func checkout(holding git: URL) -> URL {
        guard let pointer = try? String(contentsOf: git, encoding: .utf8),
              let gitDir = pointer.split(separator: " ").last?
              .trimmingCharacters(in: .whitespacesAndNewlines),
              gitDir.contains("/worktrees/")
        else { return git.deletingLastPathComponent() }
        return URL(fileURLWithPath: gitDir)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
    }
}
