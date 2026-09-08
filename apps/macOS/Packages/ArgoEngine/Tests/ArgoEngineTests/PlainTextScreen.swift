@testable import ArgoEngine
import Foundation

/// A "terminal" that does no emulation at all: every line the agent wrote, in the order it wrote.
struct PlainTextScreen: TerminalScreen {
    func rows(painted output: [UInt8], columns _: Int, rows _: Int) -> [String] {
        (String(bytes: output, encoding: .utf8) ?? "").components(separatedBy: "\n")
    }
}
