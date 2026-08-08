@testable import ArgoEngine
import Foundation

/// A process host that starts nothing, so the spawn under test is the Hub's bookkeeping rather than
/// a real `claude` this machine may or may not have.
@MainActor
final class FakeProcessHost: AgentProcessHost {
    /// What every launch is answered with — a refusal when set, so the failure path is exercised
    /// by the same seam the success path goes through.
    var refusal: AgentSpawnError?
    private(set) var launches: [AgentLaunch] = []
    private(set) var started: [FakeAgentProcess] = []

    func start(_ launch: AgentLaunch, events: AgentProcessEvents) throws -> AgentProcess {
        if let refusal {
            throw refusal
        }
        launches.append(launch)
        let process = FakeAgentProcess(events: events)
        started.append(process)
        return process
    }

    /// The PTY of the most recent spawn, ended the way the real host would report it.
    func endLastProcess(exitCode: Int32?) {
        started.last?.end(exitCode: exitCode)
    }
}

@MainActor
final class FakeAgentProcess: AgentProcess {
    private let events: AgentProcessEvents
    private(set) var written: [String] = []
    private(set) var isTerminated = false

    init(events: AgentProcessEvents) {
        self.events = events
    }

    func write(_ text: String) {
        written.append(text)
    }

    func resize(columns _: Int, rows _: Int) {}

    func terminate() {
        isTerminated = true
    }

    func emit(_ chunk: String) {
        events.onData(Array(chunk.utf8))
    }

    func end(exitCode: Int32?) {
        events.onExit(exitCode)
    }
}

/// Everything one spawn test needs on disk, plus the Hub pointed at it.
///
/// A real project folder, a real `PATH` holding a real (if inert) `claude`, and a real companion
/// root: the parts of the spawn that touch the file system are exercised rather than stubbed, and
/// the only thing standing in for the world is the PTY itself.
@MainActor
struct SpawnFixture {
    let root: URL
    let projectURL: URL
    let host = FakeProcessHost()
    let hub: Hub

    /// The companion root is a SHORT path of its own rather than a folder under `root`, for the
    /// reason the channel's own default is short: a `sockaddr_un` path is 103 bytes, and a
    /// temp-directory prefix plus a UUID spends them.
    let companionRoot: URL

    init(liveness: @escaping LivenessRead = noLiveProcesses) throws {
        let token = String(UUID().uuidString.prefix(8))
        self.root = URL(fileURLWithPath: NSTemporaryDirectory())
            .appending(path: "argo-spawn-\(token)", directoryHint: .isDirectory)
        self.projectURL = root.appending(path: "project", directoryHint: .isDirectory)
        self.companionRoot = URL(fileURLWithPath: "/tmp/argo-t-\(token)", isDirectory: true)
        let binURL = root.appending(path: "bin", directoryHint: .isDirectory)
        for directory in [projectURL, binURL, companionRoot] {
            try FileManager.default.createDirectory(
                at: directory,
                withIntermediateDirectories: true,
            )
        }
        try Self.installExecutable(named: "claude", in: binURL)
        self.hub = Hub(
            projectURL: projectURL,
            engine: Engine(readCheckout: CheckoutFixture().read, readLiveness: liveness),
            spawnServices: SpawnServices(
                host: host,
                // A `PATH` the test owns, so the launch resolves against a folder it wrote rather
                // than against whatever this Mac happens to have installed.
                launcher: AgentLauncher(run: { _ in "\(binURL.path)\n" }),
                companionRoot: companionRoot,
            ),
        )
    }

    /// The resolved project path — what a claim is keyed by, and what the CLI would record. The
    /// two differ before resolution on any Mac, because `NSTemporaryDirectory` is under `/var`.
    var resolvedProjectPath: String {
        resolvedPath(projectURL.path)
    }

    func remove() {
        try? FileManager.default.removeItem(at: root)
        try? FileManager.default.removeItem(at: companionRoot)
    }

    private static func installExecutable(named name: String, in directory: URL) throws {
        let url = directory.appending(path: name)
        try "#!/bin/sh\n".write(to: url, atomically: true, encoding: .utf8)
        try FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: url.path)
    }
}
