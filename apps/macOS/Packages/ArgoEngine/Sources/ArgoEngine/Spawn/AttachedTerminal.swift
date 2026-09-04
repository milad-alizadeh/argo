import Foundation

/// One viewer's handle on a live agent PTY.
///
/// `detach` stops delivery to this viewer and nothing else: the agent keeps running and keeps being
/// drained, because the pane is a window onto the agent and never the reason it is alive.
@MainActor
struct AttachedTerminal {
    private let process: AgentProcess
    private let recordSize: (TerminalSize) -> Void
    private let stopDelivering: () -> Void

    init(
        process: AgentProcess,
        resized: @escaping (TerminalSize) -> Void,
        detach: @escaping () -> Void,
    ) {
        self.process = process
        self.recordSize = resized
        self.stopDelivering = detach
    }

    func write(_ text: String) {
        process.write(text)
    }

    /// Told to the child AND to the table behind it: the size is what a screen read off this
    /// claim is painted at (#1266), and this pane is the only thing that knows it.
    func resize(columns: Int, rows: Int) {
        process.resize(columns: columns, rows: rows)
        recordSize(TerminalSize(columns: columns, rows: rows))
    }

    func detach() {
        stopDelivering()
    }
}
