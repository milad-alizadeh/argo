import Foundation

/// One viewer's handle on a live agent PTY.
///
/// `detach` stops delivery to this viewer and nothing else: the agent keeps running and keeps being
/// drained, because the pane is a window onto the agent and never the reason it is alive.
@MainActor
public struct AttachedTerminal {
    private let process: AgentProcess
    private let stopDelivering: () -> Void

    init(process: AgentProcess, detach: @escaping () -> Void) {
        self.process = process
        self.stopDelivering = detach
    }

    public func write(_ text: String) {
        process.write(text)
    }

    public func resize(columns: Int, rows: Int) {
        process.resize(columns: columns, rows: rows)
    }

    public func detach() {
        stopDelivering()
    }
}
