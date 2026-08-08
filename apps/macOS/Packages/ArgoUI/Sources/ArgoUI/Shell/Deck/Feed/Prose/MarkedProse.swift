import Foundation
import SwiftUI

/// The inline marks a CLI writes, given the ink each one earns.
///
/// SwiftUI already draws a `code` span in a mono face, and that is the whole of what it does: the
/// span keeps the ink of the sentence around it. In a paragraph of prose a mono face at the same
/// colour is a signal a reader has to look for, and the run in question is almost always the one
/// they came for — a filename, a flag, the command that failed.
///
/// Colour is not decoration here, it is the marker the backticks stopped being. This is a reading
/// of the AGENT'S OWN marks and never a parse of what is inside them: a span is tinted because it
/// was written between backticks, not because anything guessed at a language.
enum MarkedProse {
    static func inked(_ prose: AttributedString, code: ArgoColor) -> AttributedString {
        var inked = prose
        for run in prose.runs where isCode(run) {
            inked[run.range].foregroundColor = code.color
        }
        return inked
    }

    private static func isCode(_ run: AttributedString.Runs.Run) -> Bool {
        run.inlinePresentationIntent?.contains(.code) ?? false
    }
}
