import ArgoEngine
import Foundation
import HighlightSwift

/// A hunk's lines, coloured — each SIDE of it read as its own program.
///
/// The reason this is not one call to the highlighter. A hunk with both sides in it is not source
/// in any language: a modified declaration appears twice, an `if` that gained a condition has two
/// heads and one body, and a brace removed on one line is added back on the next. The grammar will
/// colour that happily and wrongly, and wrongly-coloured code looks exactly like code.
///
/// So it is parsed twice — once as the file BEFORE (context + removed) and once as the file AFTER
/// (context + added) — and each line takes the colours from the program it was actually part of.
/// A context line is in both; the after-side wins it, because that is the file the patch left
/// behind and the one the gutter is numbered for.
enum SyntaxPatch {
    /// One entry per line of the hunk, in its order. `nil` where the grammar could not reach that
    /// line, which the caller draws plain.
    static func lines(
        of hunk: [DiffLine],
        in language: EvidenceLanguage,
        colors: HighlightColors,
    ) async
        -> [AttributedString?] {
        var coloured = [AttributedString?](repeating: nil, count: hunk.count)
        for side in sides(of: hunk) {
            guard let run = await SyntaxHighlight.lines(
                of: side.map { hunk[$0].text },
                in: language,
                colors: colors,
            ) else { continue }
            for (position, line) in zip(side, run) {
                coloured[position] = line
            }
        }
        return coloured
    }

    /// The positions making up each program, before-side first so the after-side's colours win
    /// where they overlap. A hunk of pure context is ONE program, not the same one twice.
    private static func sides(of hunk: [DiffLine]) -> [[Int]] {
        let before = hunk.indices.filter { hunk[$0].side != .add }
        let after = hunk.indices.filter { hunk[$0].side != .del }
        return before == after ? [after] : [before, after]
    }
}
