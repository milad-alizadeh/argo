import Foundation

/// One hidden `claude`, opened only to be asked what its built-in commands are (#686).
///
/// No claim is made on it, no roster row is drawn for it, and it is killed the moment the panel has
/// been painted.
@MainActor
struct HelpPanelSession {
    /// The whole panel has to fit on one screen: a shorter terminal stops mid-list, and `HelpPanel`
    /// then refuses the read. 400 rows holds all 99 commands of `claude` 2.1.233, and 120 columns
    /// leaves a description clamped by the panel rather than wrapped by the terminal.
    static let size = (columns: 120, rows: 400)

    let host: AgentProcessHost
    let launcher: AgentLauncher
    let screen: TerminalScreen
    var pace = HelpPanelPace()

    /// The Commands tab of `/help`, as a rendered screen — or the last screen there was, when it
    /// never opened.
    func rows(inProjectAt projectURL: URL) async throws -> [String] {
        let launch = try await launcher.launch(cli: .claude, cwd: projectURL.path, companion: nil)
        let painted = Painted()
        let agent = try host.start(launch, events: AgentProcessEvents(
            onData: { painted.append($0) },
            onExit: { _ in },
        ))
        defer { agent.terminate() }
        agent.resize(columns: Self.size.columns, rows: Self.size.rows)
        await pause(pace.untilReady)
        return await opened(at: agent, painting: painted)
    }

    /// Ask for the panel until it is on the screen, and give up after `pace.attempts`.
    ///
    /// It is asked more than once because a `claude` opening a folder it has never seen swallows
    /// the first keystrokes it is sent, silently and with nothing drawn to wait for — measured
    /// against 2.1.233, where the second ask lands every time. Waiting longer does not help: the
    /// keystrokes are gone rather than early.
    private func opened(at agent: AgentProcess, painting painted: Painted) async -> [String] {
        var screenRows: [String] = []
        for _ in 0 ..< pace.attempts {
            await type(at: agent)
            screenRows = screen.rows(
                painted: painted.bytes,
                columns: Self.size.columns,
                rows: Self.size.rows,
            )
            if HelpPanel.isOpen(on: screenRows) {
                return screenRows
            }
        }
        return screenRows
    }

    /// Open the panel and walk to the tab the commands are on.
    private func type(at agent: AgentProcess) async {
        agent.write("/help")
        await pause(pace.untilTyped)
        agent.write("\r")
        await pause(pace.untilOpen)
        agent.write("\t")
        await pause(pace.untilDrawn)
    }

    private func pause(_ duration: Duration) async {
        try? await Task.sleep(for: duration)
    }

    /// Everything the PTY has said. A reference type so the host's callback and the read after it
    /// are looking at one buffer rather than two copies of it.
    @MainActor
    private final class Painted {
        private(set) var bytes: [UInt8] = []

        func append(_ chunk: [UInt8]) {
            bytes += chunk
        }
    }
}
