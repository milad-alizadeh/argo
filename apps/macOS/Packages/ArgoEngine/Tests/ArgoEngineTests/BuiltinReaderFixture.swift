@testable import ArgoEngine
import Foundation

/// A machine a `BuiltinCommandReader` can run on: a real Project folder, a real `PATH` with a real
/// (if inert) `claude` on it, a real file to keep the answer in — and two stand-ins.
///
/// The two are the PTY and the terminal that would paint it. Both are outside this repo, and
/// neither can be run for real in a suite: one starts an agent, the other links AppKit.
@MainActor
final class BuiltinReaderFixture {
    let rootURL: URL
    let host = FakeProcessHost()

    private let launcher: AgentLauncher

    init() throws {
        self.rootURL = FileManager.default.temporaryDirectory
            .appending(path: "argo-builtins-\(UUID().uuidString)", directoryHint: .isDirectory)
        let binURL = rootURL.appending(path: "bin", directoryHint: .isDirectory)
        let projectURL = rootURL.appending(path: "project", directoryHint: .isDirectory)
        for directory in [projectURL, binURL] {
            try FileManager.default.createDirectory(
                at: directory,
                withIntermediateDirectories: true,
            )
        }
        try Self.installExecutable(named: AgentCLI.claude.command, in: binURL)
        self.launcher = AgentLauncher(run: { _ in "\(binURL.path)\n" })
    }

    deinit { try? FileManager.default.removeItem(at: rootURL) }

    var projectURL: URL {
        rootURL.appending(path: "project", directoryHint: .isDirectory)
    }

    /// The user's own skills folder, so the reader under test walks THIS machine's fixture rather
    /// than whatever the person running the suite happens to have installed.
    var homeURL: URL {
        rootURL.appending(path: "home", directoryHint: .isDirectory)
    }

    /// One skill, standing for the half of the catalog that answers straight away.
    let projectSkill = Command(name: "implement", description: "Build it.", origin: .project)

    /// A reader over this machine's own folders. `showing` is what the terminal would have painted
    /// — the captured panel unless a test wants the failure — and `reporting` is what the CLI says
    /// its version is.
    func reader(
        showing rows: [String]? = nil,
        reporting version: String = "2.1.231 (Claude Code)",
    )
        -> BuiltinCommandReader {
        BuiltinCommandReader(
            store: BuiltinCommandStore(fileURL: rootURL.appending(path: "builtins.json")),
            session: HelpPanelSession(
                host: host,
                launcher: launcher,
                screen: StubScreen(rows: rows ?? panel),
                pace: .none,
            ),
            version: { _ in version },
            skills: SkillReading(homeURL: homeURL),
        )
    }

    /// Ask, and wait for the answer. The reader hands control back the moment the work is under
    /// way, so a test that asserted straight after it would be asserting on the wait.
    func finish(_ reader: BuiltinCommandReader) async {
        reader.read(inProjectAt: projectURL)
        await settle()
    }

    /// Let every task the read spawned run to its end. Yielding rather than sleeping, because
    /// nothing in this fixture waits on a clock.
    func settle() async {
        for _ in 0 ..< 200 {
            await Task.yield()
        }
    }

    private var panel: [String] {
        (try? HelpPanelFixture.whole()) ?? []
    }

    /// A file that is executable and does nothing, so `AgentExecutable.locate` finds a `claude`
    /// here rather than on the machine running the suite.
    private static func installExecutable(named name: String, in binURL: URL) throws {
        let url = binURL.appending(path: name)
        try Data("#!/bin/sh\n".utf8).write(to: url)
        try FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: url.path)
    }
}

/// A terminal that paints whatever it was handed, ignoring the bytes. What it stands in for is
/// SwiftTerm, which is not this repo's and links AppKit besides.
private struct StubScreen: TerminalScreen {
    let rows: [String]

    func rows(painted _: [UInt8], columns _: Int, rows _: Int) -> [String] {
        rows
    }
}
