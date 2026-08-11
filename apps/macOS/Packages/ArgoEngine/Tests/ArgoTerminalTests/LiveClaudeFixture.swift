import ArgoEngine
import ArgoTerminal
import Foundation

/// Whether the live-CLI tests run: they spawn the real `claude`, spend the user's tokens, and take
/// as long as an agent takes. Off unless asked for, by name, in the environment.
enum LiveCLI {
    static let isEnabled = ProcessInfo.processInfo.environment["ARGO_LIVE_CLI"] == "1"
}

/// The real host with a tap on it: every byte the agent writes is kept, so a live test that fails
/// can say what the CLI was actually showing instead of only that nothing arrived.
@MainActor
final class RecordingProcessHost: AgentProcessHost {
    private let host = SwiftTermProcessHost()
    private(set) var received: [UInt8] = []
    private(set) var launches: [AgentLaunch] = []

    func start(_ launch: AgentLaunch, events: AgentProcessEvents) throws -> AgentProcess {
        launches.append(launch)
        return try host.start(launch, events: AgentProcessEvents(
            onData: { [weak self] chunk in
                self?.received += chunk
                events.onData(chunk)
            },
            onExit: events.onExit,
        ))
    }

    /// The tail of what the PTY carried, escape sequences and all. A terminal's bytes are not text
    /// in general; this is for a human reading a failure, not for an assertion — and it is the
    /// tail because what the CLI is showing NOW is what says why nothing was raised.
    var lastScreens: String {
        String(bytes: received.suffix(4000), encoding: .utf8) ?? ""
    }
}

/// One real `claude` under a real Hub: the same PTY host, launcher and companion root the app
/// composes, in a temp folder of its own.
///
/// Nothing here is a stand-in: the permission gate is a hook the CLI installs, dials and blocks on,
/// so only the real CLI can say whether it honours the reply we send.
@MainActor
final class LiveClaudeFixture {
    /// The path the agent is asked to create. The file is the evidence: the command's own text is
    /// echoed by the TUI whatever is decided, so only the filesystem tells a call that ran from
    /// one that was refused.
    let markerURL: URL
    let hub: Hub
    let claim: SessionOwnership.ClaimID
    let host: RecordingProcessHost

    private let root: URL
    private let companionRoot: URL

    private init(
        root: URL,
        companionRoot: URL,
        hub: Hub,
        claim: SessionOwnership.ClaimID,
        host: RecordingProcessHost,
    ) {
        self.root = root
        self.companionRoot = companionRoot
        self.hub = hub
        self.claim = claim
        self.host = host
        self.markerURL = root.appending(path: "the-agent-was-here")
    }

    /// A spawned Session with its folder trusted, ready to be asked something.
    static func spawned() async throws -> LiveClaudeFixture {
        let token = String(UUID().uuidString.prefix(8))
        let root = URL(fileURLWithPath: NSTemporaryDirectory())
            .appending(path: "argo-live-\(token)", directoryHint: .isDirectory)
        // Short, for the reason the spawn fixture's is short: a `sockaddr_un` path is 103 bytes.
        let companionRoot = URL(fileURLWithPath: "/tmp/argo-l-\(token)", isDirectory: true)
        for directory in [root, companionRoot] {
            try FileManager.default.createDirectory(
                at: directory,
                withIntermediateDirectories: true,
            )
        }
        let host = RecordingProcessHost()
        let hub = Hub(
            projectURL: root,
            spawnServices: SpawnServices(host: host, companionRoot: companionRoot),
        )
        let claim = try await hub.spawnSession()
        let fixture = LiveClaudeFixture(
            root: root,
            companionRoot: companionRoot,
            hub: hub,
            claim: claim,
            host: host,
        )
        try await fixture.trustTheFolder()
        return fixture
    }

    /// Put one Turn to the Session, down the same path the composer sends on.
    func ask(_ prompt: String) throws {
        try hub.driver.send(prompt, to: claim.value)
    }

    /// The oldest Permission this Session is blocked on, once it has raised one. A real agent
    /// thinks before it acts, so the wait is generous rather than tight.
    func pendingPermission() async -> PermissionRequest? {
        await settle(seconds: 180) { self.hub.sessions.first?.permission != nil }
        return hub.sessions.first?.permission
    }

    func hasMarkerFile() -> Bool {
        FileManager.default.fileExists(atPath: markerURL.path)
    }

    func end() {
        hub.endOwnedSessions()
        try? FileManager.default.removeItem(at: root)
        try? FileManager.default.removeItem(at: companionRoot)
    }

    /// Yield until a condition holds, or the bound runs out. A real CLI answers when it answers.
    ///
    /// `Task.yield` and never `Task.sleep`: the gate's socket is read by a dispatch source on the
    /// main queue, and a sleeping test leaves that queue unserviced — the hook connects, blocks,
    /// and nothing on this side ever hears it.
    func settle(seconds: Int, until condition: () -> Bool) async {
        let deadline = ContinuousClock.now + .seconds(seconds)
        while ContinuousClock.now < deadline, !condition() {
            await Task.yield()
        }
    }

    /// `claude` opens a folder it has never seen with a trust question, and answers to `1`. Sent
    /// blind because Argo reads no PTY output here — the question is the first thing a fresh
    /// folder shows, and the terminal holds the keystroke until the CLI is ready to read it.
    private func trustTheFolder() async throws {
        await pause(seconds: 3)
        try hub.driver.send("1", to: claim.value)
        await pause(seconds: 3)
    }

    /// A wait that keeps the main queue turning — see `settle`.
    private func pause(seconds: Int) async {
        await settle(seconds: seconds) { false }
    }
}
