import Foundation

// How big a terminal is, in cells.

///
/// A value rather than two `Int`s, because they travel together through four hands — the pane that
/// lays one out, the PTY that is told about it, the table that remembers it, and the screen painted
/// at it — and two same-typed numbers in a fixed order swap silently at any of them.
public struct TerminalSize: Equatable, Sendable {
    public let columns: Int
    public let rows: Int

    public init(columns: Int, rows: Int) {
        self.columns = columns
        self.rows = rows
    }

    /// What a child is told before any pane has laid a terminal out. It exists so the agent does
    /// not draw for an 0x0 screen, and it is ONE value because two would drift: the host sets it on
    /// the descriptor and `AgentTerminals` paints an unattached claim's screen at it, and a screen
    /// painted at a width the CLI never had wraps where the CLI did not (#1266).
    public static let unattached = TerminalSize(columns: 80, rows: 24)
}
