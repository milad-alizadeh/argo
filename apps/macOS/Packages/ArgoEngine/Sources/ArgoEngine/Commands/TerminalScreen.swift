/// What a terminal would have DRAWN for a stream of PTY bytes, one string per row (#686).
///
/// A port, because a TUI's output is not text: `claude` positions its cursor and paints over what
/// it already wrote, so the Help panel exists only on a rendered screen and never in the byte
/// stream. Rendering one needs a terminal emulator, and the emulator this repo has links AppKit —
/// which is why the implementation lives in `ArgoTerminal` and the engine only names the shape.
public protocol TerminalScreen: Sendable {
    /// The rows a terminal of this size would be showing after the whole stream. Trailing spaces
    /// are the emulator's; what reads them trims.
    func rows(painted output: [UInt8], columns: Int, rows: Int) -> [String]
}
