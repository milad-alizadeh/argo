import Foundation

/// The three things a Hub cannot build for itself, because each of them links AppKit and the engine
/// has to run with no window: what starts a PTY agent, what starts a `codex app-server` beside it,
/// and what paints a PTY's bytes into the rows a terminal would be showing.
///
/// One value rather than three parameters because they are one reading — what this window can start
/// and see — and because every one of them being absent means the same thing: a Hub that observes.
@MainActor
public struct SpawnHosts {
    /// The host that says this window may start agents AT ALL. `nil` is the render harness and
    /// every suite about observation.
    public let pty: AgentProcessHost?
    /// What starts a `codex app-server`, where the engine's own pipe host is not what should run —
    /// a suite that must not launch a real CLI. `nil` takes `CodexProcessHost`, which is what the
    /// app wants and what needs no window.
    public let codex: AgentProcessHost?
    /// What paints a claim's PTY into rows, for the one reading that needs a picture rather than
    /// bytes: whether the composer still holds the Turn Argo typed (#1266). `nil` reads no screen
    /// at all, and then a Turn is never reported lost — the quiet answer the engine takes where it
    /// cannot see.
    public let screen: TerminalScreen?

    public init(
        pty: AgentProcessHost?,
        codex: AgentProcessHost? = nil,
        screen: TerminalScreen? = nil,
    ) {
        self.pty = pty
        self.codex = codex
        self.screen = screen
    }

    /// A Hub that starts nothing and paints nothing.
    public static let none = SpawnHosts(pty: nil)
}
