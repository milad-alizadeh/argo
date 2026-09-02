import ArgoDesign
@testable import ArgoUI
import Foundation
import SwiftUI
import Testing

/// The mark tracks the agent's backticks and nothing else. Every claim here is about WHICH
/// characters get it.
///
/// A `code` span is drawn as a GROUND, not a hue, so in the ordinary case it takes no ink at all
/// and these tests would have nothing to read. They pass a `span` ink — the floor case, the one
/// voice quiet enough that inheriting would put the run under the contrast floor on its own
/// ground. Same runs either way; the ink is what makes the choice observable.
@Suite("Marked prose")
struct MarkedProseTests {
    let ink = ArgoPalette.graphite.text.secondary
    let linkInk = ArgoPalette.graphite.interaction.accent

    @Test
    func `a code span is marked and the sentence around it is not`() {
        let inked = MarkedProse.inked(
            parsed("Read `FeedView.swift` first."),
            span: ink,
            link: linkInk,
        )

        #expect(coloured(inked) == ["FeedView.swift"])
    }

    /// Bold is not machine text. It was already told apart by weight, and a second signal on it
    /// would leave the mark meaning "emphasis of some kind" rather than "this is a token".
    @Test
    func `emphasis takes no mark — only code does`() {
        let inked = MarkedProse.inked(
            parsed("The **ramp** and `surface.base`."),
            span: ink,
            link: linkInk,
        )

        #expect(coloured(inked) == ["surface.base"])
    }

    @Test
    func `every span in a line is marked, not just the first`() {
        let inked = MarkedProse.inked(
            parsed("Drops `VAR=value` and `cd …` preludes."),
            span: ink,
            link: linkInk,
        )

        #expect(coloured(inked) == ["VAR=value", "cd …"])
    }

    @Test
    func `prose with no marks in it comes back untouched`() {
        let plain = parsed("Nothing here was marked.")

        #expect(MarkedProse.inked(plain, span: ink, link: linkInk) == plain)
    }

    /// The ordinary case, and the reason the span parameter is an Optional rather than a colour:
    /// a marked run inherits the voice around it, so nothing is written onto it at all.
    @Test
    func `with no floor in force a code span takes no ink of its own`() {
        let source = parsed("Read `FeedView.swift` first.")
        let inked = MarkedProse.inked(source, span: nil, link: linkInk)

        #expect(inked == source)
        #expect(inked.runs.allSatisfy { $0.foregroundColor == nil })
    }

    /// Colour is not enough on its own — a reader who cannot separate two hues sees an ordinary
    /// word. The rule under it is what still says "pressable" to them.
    @Test
    func `a link is inked and ruled, and nothing else is`() {
        let inked = MarkedProse.inked(
            parsed("See [ADR-0020](https://example.com) and `Plan`."),
            span: ink,
            link: linkInk,
        )
        let ruled = inked.runs.filter { $0.underlineStyle != nil }

        #expect(ruled.map { String(inked[$0.range].characters) } == ["ADR-0020"])
        #expect(ruled.allSatisfy { $0.foregroundColor == linkInk.color })
    }

    private func parsed(_ text: String) -> AttributedString {
        (try? AttributedString(
            markdown: text,
            options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace),
        )) ?? AttributedString(text)
    }

    /// The runs the mark landed on, as their characters — the only observable that says the
    /// right span was picked rather than merely that some span was.
    private func coloured(_ prose: AttributedString) -> [String] {
        prose.runs.compactMap { run in
            guard run.foregroundColor == ink.color else { return nil }
            return String(prose[run.range].characters)
        }
    }
}
