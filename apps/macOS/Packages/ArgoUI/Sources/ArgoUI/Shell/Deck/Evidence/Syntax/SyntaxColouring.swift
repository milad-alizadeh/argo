import Foundation
import SwiftUI

/// The grammar's answer to one request — the colours, and the characters they were read from.
///
/// A `Reading` is the only thing a surface can draw from, and `over(_:)` is the only thing that
/// makes one. So `SyntaxRequest`'s rule is a compiler check: dropping the narrowing at a call site
/// does not compile, where dropping a comparison inside it would only fail a test.
struct SyntaxColouring: Sendable {
    /// The colours a surface may draw, already narrowed to the characters under them.
    struct Reading {
        private let lines: [AttributedString?]

        fileprivate init(_ lines: [AttributedString?]) {
            self.lines = lines
        }

        /// One line under the grammar. Guarded rather than trusted: the run is a request behind the
        /// characters for as long as the grammar takes to answer.
        subscript(position: Int) -> AttributedString? {
            lines.indices.contains(position) ? lines[position] : nil
        }

        /// The run as ONE string, for a surface that draws its characters in a single `Text` rather
        /// than a row per line.
        var whole: AttributedString? {
            let read = lines.compactMap(\.self)
            guard let first = read.first else { return nil }
            return read.dropFirst().reduce(into: first) { block, line in
                block += AttributedString("\n") + line
            }
        }
    }

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

    /// These colours over THOSE characters — nothing at all unless they are the same characters.
    func over(_ request: SyntaxRequest) -> Reading {
        Reading(self.request == request ? lines : [])
    }

    private static func read(_ request: SyntaxRequest) async -> [AttributedString?] {
        switch request {
        case let .source(lines, language):
            await SyntaxHighlight.lines(
                of: lines,
                in: language,
                colors: SyntaxTheme.colors,
            ) ?? []
        case let .patch(lines, .some(language)):
            await SyntaxPatch.lines(of: lines, in: language, colors: SyntaxTheme.colors)
        // A fence is a file whose lines the reader never sees, so it is read as one and joined back
        // by `Reading.whole`.
        case let .block(code, .some(language)):
            await read(.source(lines: code.components(separatedBy: "\n"), under: language))
        case .patch, .block:
            []
        }
    }
}
