@testable import ArgoUI
import Foundation
import SwiftUI
import Testing

/// The tint tracks the agent's backticks and nothing else. Every claim here is about WHICH
/// characters get it — the ink itself is the visual contract's.
@Suite("Marked prose")
struct MarkedProseTests {
    let ink = ArgoPalette.graphite.text.code
    let linkInk = ArgoPalette.graphite.interaction.accent

    @Test
    func `a code span is inked and the sentence around it is not`() {
        let inked = MarkedProse.inked(
            parsed("Read `FeedView.swift` first."),
            code: ink,
            link: linkInk,
        )

        #expect(coloured(inked) == ["FeedView.swift"])
    }

    /// Bold is not machine text. It was already told apart by weight, and a second signal on it
    /// would leave the tint meaning "emphasis of some kind" rather than "this is a token".
    @Test
    func `emphasis takes no ink — only code does`() {
        let inked = MarkedProse.inked(
            parsed("The **ramp** and `surface.base`."),
            code: ink,
            link: linkInk,
        )

        #expect(coloured(inked) == ["surface.base"])
    }

    @Test
    func `every span in a line is inked, not just the first`() {
        let inked = MarkedProse.inked(
            parsed("Drops `VAR=value` and `cd …` preludes."),
            code: ink,
            link: linkInk,
        )

        #expect(coloured(inked) == ["VAR=value", "cd …"])
    }

    @Test
    func `prose with no marks in it comes back untouched`() {
        let plain = parsed("Nothing here was marked.")

        #expect(MarkedProse.inked(plain, code: ink, link: linkInk) == plain)
    }

    /// Colour is not enough on its own — a reader who cannot separate two hues sees an ordinary
    /// word. The rule under it is what still says "pressable" to them.
    @Test
    func `a link is inked and ruled, and nothing else is`() {
        let inked = MarkedProse.inked(
            parsed("See [ADR-0020](https://example.com) and `Plan`."),
            code: ink,
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

    /// The runs the tint landed on, as their characters — the only observable that says the
    /// right span was picked rather than merely that some span was.
    private func coloured(_ prose: AttributedString) -> [String] {
        prose.runs.compactMap { run in
            guard run.foregroundColor == ink.color else { return nil }
            return String(prose[run.range].characters)
        }
    }
}
