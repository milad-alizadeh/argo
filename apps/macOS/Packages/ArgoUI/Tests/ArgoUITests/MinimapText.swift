@testable import ArgoUI
import Foundation

/// Words for the lane's suites to measure, where a test cares how many LINES they make and not what
/// they say.
enum MinimapText {
    /// Long enough to wrap several times at the feed's own measure, and ending short of a line so
    /// the ragged last one is a real claim rather than a coincidence.
    static let paragraph = String(
        repeating: "The ramp had drifted navy and nobody had looked at it. ", count: 6,
    ) + "Two words."

    /// A run of `length` characters, for the suites that need a string of a stated size.
    static func words(_ length: Int) -> String {
        String(repeating: "a", count: max(0, length))
    }
}

extension MinimapRowShape {
    /// A row the feed says in one line, for the suites about where a row lands rather than about
    /// what it is drawn as.
    static let oneLine = MinimapRowShape.line(
        parts: [.words("Ran bun run quality", .command)], ink: .command,
    )
}
