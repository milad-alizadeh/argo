import Foundation
import SwiftUI

/// The grammar's answer to one request — the colours, and the characters they were read from.
///
/// It carries its own request and hands out nothing when asked for another's, which is how
/// `SyntaxRequest`'s rule is ENFORCED rather than remembered: a recycled row asking for the file it
/// is drawing now either gets that file's colours or gets none, and can never get the last file's.
///
/// Every miss is nothing, never a substitute. A line before the colours arrive, a line the grammar
/// could not reach, and a read past the end of the run all draw the characters as they arrived —
/// which is what a surface showing a record owes its reader.
struct SyntaxColouring: Sendable {
    /// No colours at all: the first frame of every surface, and every frame of one whose grammar
    /// Argo cannot read.
    static let plain = SyntaxColouring(request: nil, lines: [])

    private let request: SyntaxRequest?
    private let lines: [AttributedString?]

    private init(request: SyntaxRequest?, lines: [AttributedString?]) {
        self.request = request
        self.lines = lines
    }

    /// One request, read under the panel's one theme.
    init(of request: SyntaxRequest) async {
        self.request = request
        self.lines = await Self.read(request)
    }

    /// These colours over THOSE characters — `plain` unless they are the same characters.
    func over(_ request: SyntaxRequest) -> SyntaxColouring {
        self.request == request ? self : .plain
    }

    /// One line under the grammar. Guarded rather than trusted: the run is a request behind the
    /// characters for as long as the grammar takes to answer.
    subscript(position: Int) -> AttributedString? {
        lines.indices.contains(position) ? lines[position] : nil
    }

    /// The run as ONE string, for a surface that draws its characters in a single `Text` rather
    /// than a row per line.
    ///
    /// Nothing unless the grammar reached every line: a block half in colour reads as a parse that
    /// worked.
    var whole: AttributedString? {
        let read = lines.compactMap(\.self)
        guard read.count == lines.count, let first = read.first else { return nil }
        return read.dropFirst().reduce(into: first) { block, line in
            block += AttributedString("\n") + line
        }
    }

    private static func read(_ request: SyntaxRequest) async -> [AttributedString?] {
        switch request {
        case let .source(lines, language):
            return await SyntaxHighlight.lines(
                of: lines,
                in: language,
                colors: SyntaxTheme.colors,
            ) ?? []
        case let .patch(lines, language):
            guard let language else { return [] }
            return await SyntaxPatch.lines(of: lines, in: language, colors: SyntaxTheme.colors)
        case let .block(code, language):
            guard let language else { return [] }
            return await SyntaxHighlight.lines(
                of: code.components(separatedBy: "\n"),
                in: language,
                colors: SyntaxTheme.colors,
            ) ?? []
        }
    }
}
