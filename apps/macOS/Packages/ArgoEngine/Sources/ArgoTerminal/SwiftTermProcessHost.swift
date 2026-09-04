import ArgoEngine
import Foundation
import SwiftTerm

/// The real PTY host: SwiftTerm's `LocalProcess`, which is the same process host
/// `LocalProcessTerminalView` runs on — so the Dock drawn over one of these agents (#387) draws
/// over the process Argo already owns rather than starting a second one beside it.
///
/// It lives in its own target because SwiftTerm links AppKit on macOS and `ArgoEngine` must stay
/// runnable with no window. The engine sees only `AgentProcessHost`.
@MainActor
public final class SwiftTermProcessHost: AgentProcessHost {
    public init() {}

    public func start(_ launch: AgentLaunch, events: AgentProcessEvents) throws -> AgentProcess {
        let process = SwiftTermAgentProcess(events: events)
        try process.start(launch)
        return process
    }
}

/// One agent's PTY. The delegate half of `LocalProcess` lives here rather than on the host, because
/// there is one of these per agent and `LocalProcess` holds its delegate weakly — a host acting as
/// delegate for every agent could not tell them apart, and would have to outlive all of them.
@MainActor
final class SwiftTermAgentProcess: NSObject, AgentProcess, LocalProcessDelegate {
    /// The size the child is told about before anything has laid a terminal out. A real one arrives
    /// from the first `resize`; this is only so the agent does not draw for an 0×0 screen.
    private static let initialSize = winsize(ws_row: 24, ws_col: 80, ws_xpixel: 0, ws_ypixel: 0)

    private let events: AgentProcessEvents
    private var size = SwiftTermAgentProcess.initialSize
    private var process: LocalProcess?
    /// So an exit is reported once. `LocalProcess` can report termination from its own monitor and
    /// again from a failed read, and the owner retires a row on the first one.
    private var hasExited = false

    init(events: AgentProcessEvents) {
        self.events = events
        super.init()
    }

    func start(_ launch: AgentLaunch) throws {
        // `.main`, so every callback below arrives on the actor this class is isolated to — the
        // alternative is hopping, which reorders a PTY's output.
        let process = LocalProcess(delegate: self, dispatchQueue: .main)
        self.process = process
        process.startProcess(
            executable: launch.executablePath,
            args: launch.arguments,
            environment: launch.environmentStrings,
            currentDirectory: launch.cwd,
        )
        guard process.running else {
            self.process = nil
            throw AgentSpawnError.hostRefused(detail: "\(launch.executablePath) would not start")
        }
    }

    /// `LocalProcess`'s own answer, and `false` once the exit has been reported — `reportExit`
    /// drops the process, so a child Argo already watched go cannot read as up.
    var isRunning: Bool {
        process?.running ?? false
    }

    func write(_ text: String) {
        process?.send(data: ArraySlice(Array(text.utf8)))
    }

    func resize(columns: Int, rows: Int) {
        size = winsize(
            ws_row: UInt16(max(rows, 1)),
            ws_col: UInt16(max(columns, 1)),
            ws_xpixel: 0,
            ws_ypixel: 0,
        )
        guard let process, process.childfd >= 0 else { return }
        _ = PseudoTerminalHelpers.setWinSize(
            masterPtyDescriptor: process.childfd,
            windowSize: &size,
        )
    }

    /// Ending it is also REPORTING it ended. `LocalProcess.terminate` closes the descriptor and
    /// sends `SIGTERM` without telling its delegate, and its exit monitor may already have been
    /// torn down — so the owner would be left holding a row that still reads steerable over a PTY
    /// Argo itself just killed. No exit code: a child we signalled never reported one, and absent
    /// is the honest answer rather than a zero.
    func terminate() {
        process?.terminate()
        reportExit(nil)
    }

    nonisolated func getWindowSize() -> winsize {
        MainActor.assumeIsolated { size }
    }

    nonisolated func dataReceived(slice: ArraySlice<UInt8>) {
        MainActor.assumeIsolated {
            events.onData(Array(slice))
        }
    }

    nonisolated func processTerminated(_: LocalProcess, exitCode: Int32?) {
        MainActor.assumeIsolated { reportExit(exitCode) }
    }

    /// Once only. An exit can reach here from the process monitor, from a failed read, and from our
    /// own `terminate` — and the owner retires a row on the first of them.
    private func reportExit(_ exitCode: Int32?) {
        guard !hasExited else { return }
        hasExited = true
        process = nil
        events.onExit(exitCode)
    }
}
