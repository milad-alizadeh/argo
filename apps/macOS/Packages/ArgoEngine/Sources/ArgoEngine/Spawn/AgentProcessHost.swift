import Foundation

/// What one running agent offers the process that owns it.
///
/// Three verbs: a PTY is a thing you type at, size to a viewport, and end. Anything richer belongs
/// to whatever draws it.
@MainActor
public protocol AgentProcess: AnyObject {
    /// Whether the child is still there. DIRECT — this is Argo's own process, asked directly,
    /// rather than the working directory and time window a transcript is matched on.
    ///
    /// Asked at one moment only: where the wait for the first byte has run out and the silence
    /// needs an answer (`StartupPatience`, #1245). An exit Argo WITNESSED arrives on `onExit`
    /// instead, and is the stronger fact wherever both are available.
    var isRunning: Bool { get }

    func write(_ text: String)
    /// Match the PTY to the viewport after a fit.
    func resize(columns: Int, rows: Int)
    /// Ask the agent to end. Ownership does not come back, so this is one-way.
    func terminate()
}

/// The two things the owner has to hear about: what the agent said, and that it is gone.
///
/// Bytes, not text. A PTY carries escape sequences and a read boundary can land in the middle of a
/// UTF-8 sequence, so decoding here would corrupt the chunk.
///
/// `exitCode` is optional because a PTY can also end without the child reporting one — an I/O
/// failure on the descriptor rather than an exit. Absent is not zero.
public struct AgentProcessEvents {
    public let onData: @MainActor ([UInt8]) -> Void
    public let onExit: @MainActor (Int32?) -> Void

    public init(
        onData: @escaping @MainActor ([UInt8]) -> Void,
        onExit: @escaping @MainActor (Int32?) -> Void,
    ) {
        self.onData = onData
        self.onExit = onExit
    }
}

/// The port that turns an `AgentLaunch` into a live PTY. A port rather than a call: the real host
/// links SwiftTerm and therefore AppKit, and the Hub's spawn has to be provable without a window.
@MainActor
public protocol AgentProcessHost: AnyObject {
    func start(_ launch: AgentLaunch, events: AgentProcessEvents) throws -> AgentProcess
}

/// Why a spawn did not happen, in words fit to repeat to the user (#361).
public enum AgentSpawnError: Error, Equatable {
    /// The CLI is not on the `PATH` the user's own shell would have given it.
    case executableNotFound(command: String)
    /// The folder to run in is not one.
    case unreachableWorkingDirectory(path: String)
    /// The host had the launch and still could not start it.
    case hostRefused(detail: String)

    public var detail: String {
        switch self {
        case let .executableNotFound(command):
            "\(command) is not on your PATH"
        case let .unreachableWorkingDirectory(path):
            "\(path) is not a folder"
        case let .hostRefused(detail):
            detail
        }
    }
}
