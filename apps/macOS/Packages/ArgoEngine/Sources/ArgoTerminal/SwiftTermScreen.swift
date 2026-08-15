import ArgoEngine
import Foundation
import SwiftTerm

/// The engine's `TerminalScreen`, painted by the same emulator the Dock's terminal draws with. In
/// this target for `SwiftTermProcessHost`'s reason: SwiftTerm links AppKit on macOS.
///
/// It is also its own `TerminalDelegate`, and that half answers nothing — the CLI whose bytes these
/// are is dead by the time anything is painted. It holds no state, so one of these paints any
/// number of screens.
public final class SwiftTermScreen: TerminalScreen, TerminalDelegate {
    public init() {}

    public func rows(painted output: [UInt8], columns: Int, rows: Int) -> [String] {
        let terminal = Terminal(
            delegate: self,
            options: TerminalOptions(cols: columns, rows: rows),
        )
        terminal.feed(byteArray: output)
        return (0 ..< terminal.rows).map { row in
            // A cell nothing was written into holds code 0, which `translateToString` renders as a
            // NUL character rather than a space — invisible in a dump and not whitespace to
            // anything that trims. Spaces, so a blank row really is blank.
            let painted = terminal.getLine(row: row)?.translateToString(trimRight: true) ?? ""
            return painted.replacingOccurrences(of: "\0", with: " ")
        }
    }

    public func send(source _: Terminal, data _: ArraySlice<UInt8>) {}
}
