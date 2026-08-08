import AppKit
import Foundation
import HighlightSwift
import SwiftUI

/// The patch's lines, coloured — or `nil`, and drawn plain.
///
/// A hunk is highlighted WHOLE and then cut back into lines, rather than a line at a time. A line
/// on its own is not a parse: the middle of a block comment reads as code, and the second line of
/// a multi-line string reads as whatever its characters happen to look like. Handing the grammar
/// the whole hunk is the only way the colours mean anything.
///
/// Every failure here returns `nil` and the caller draws the characters as they arrived. That is
/// the important property: highlighting is decoration over a record, and a record that cannot be
/// decorated is still the record.
enum SyntaxHighlight {
    /// One engine for the app. Building it loads highlight.js into a JavaScript context, which is
    /// not work to repeat per hunk on a panel the reader is scrolling.
    private static let engine = Highlight()

    /// A whole block, coloured — the shape a fenced block is read in, where there is no gutter to
    /// line anything up against and the block is one run of text on the screen.
    static func block(
        _ code: String,
        in language: EvidenceLanguage,
        colors: HighlightColors,
    ) async
        -> AttributedString? {
        guard let lines = await lines(
            of: code.components(separatedBy: "\n"),
            in: language,
            colors: colors,
        ) else { return nil }
        return lines.dropFirst().reduce(into: lines[0]) { block, line in
            block += AttributedString("\n") + line
        }
    }

    static func lines(
        of code: [String],
        in language: EvidenceLanguage,
        colors: HighlightColors,
    ) async
        -> [AttributedString]? {
        guard !code.isEmpty else { return nil }
        guard let highlighted = try? await engine.attributedText(
            code.joined(separator: "\n"),
            language: language.alias,
            colors: colors,
        ) else { return nil }
        return aligned(readable(highlighted), to: code)
    }

    /// The same colours, moved into the scope the view can see.
    ///
    /// The highlighter builds its result by importing HTML, so every colour lands in the AppKit
    /// attribute scope — and SwiftUI's `Text` reads the SwiftUI one and silently ignores the rest.
    /// Nothing about that is visible at the call site: the patch simply renders in one ink, which
    /// is exactly what an unhighlightable file is supposed to look like.
    private static func readable(_ attributed: AttributedString) -> AttributedString {
        var readable = attributed
        for run in attributed.runs {
            guard let ink = run.appKit.foregroundColor else { continue }
            readable[run.range].foregroundColor = Color(nsColor: ink)
        }
        return readable
    }

    /// The highlighted run, split on its newlines and put back against the lines it was made from.
    ///
    /// The repair is why this exists. The highlighter trims whitespace and newlines off both ends
    /// of what it is handed — which is right for a whole file and wrong for a hunk, whose first
    /// line is usually indented and whose last lines may be blank. Nothing INSIDE the run is
    /// touched, so exactly two things have to be given back: the blank lines either end, and the
    /// indent on the first line that has anything on it.
    ///
    /// A count that still does not match is `nil` rather than a best effort. Colours drawn against
    /// the wrong numbers in the gutter is a worse patch than an uncoloured one, and it is the
    /// failure a reader would never notice.
    private static func aligned(
        _ highlighted: AttributedString,
        to code: [String],
    )
        -> [AttributedString]? {
        guard let first = code.firstIndex(where: written),
              let last = code.lastIndex(where: written)
        else { return nil }
        var body = split(highlighted)
        guard body.count == last - first + 1 else { return nil }
        body[0] = indent(of: code[first]) + body[0]
        let blank = AttributedString("")
        return Array(repeating: blank, count: first)
            + body
            + Array(repeating: blank, count: code.count - 1 - last)
    }

    private static func written(_ line: String) -> Bool {
        !line.trimmingCharacters(in: .whitespaces).isEmpty
    }

    /// The whitespace the trim ate, handed back as plain characters. Indentation carries no colour
    /// in any grammar, so nothing is lost by putting it back uncoloured.
    private static func indent(of line: String) -> AttributedString {
        AttributedString(String(line.prefix(while: \.isWhitespace)))
    }

    private static func split(_ attributed: AttributedString) -> [AttributedString] {
        var lines: [AttributedString] = []
        var start = attributed.startIndex
        for index in attributed.characters.indices where attributed.characters[index] == "\n" {
            lines.append(AttributedString(attributed[start ..< index]))
            start = attributed.characters.index(after: index)
        }
        return lines + [AttributedString(attributed[start...])]
    }
}
