import ArgoDesign
@testable import ArgoUI
import CoreGraphics
import ProseText
import Testing

/// A block of prose takes the voice its KIND is owed, and the pane's markdown is inked by the
/// ramp rather than pinned to one rung of it (#1597).
///
/// The renderer used to carry one ink for every block, so a `##` a tracker wrote set in the same
/// grey as the paragraph under it — quieter than the pane's own `Children` heading beside it.
@MainActor
@Suite("Prose voices")
struct ProseVoiceTests {
    private static let measure = FeedRowMeasure.measure(atWidth: 620)
    private static let palette = ArgoPalette.graphite

    @Test
    func `a heading is placed as a heading and the prose under it as body`() {
        let placed = FeedProseFrame.of(
            text: "## What carries it\n\nNine children, two of them closed.",
            across: Self.measure,
        )
        #expect(Self.kinds(of: placed) == [.heading, .body])
    }

    @Test
    func `a list item's own words are prose, however deep the list is under a heading`() {
        let placed = FeedProseFrame.of(
            text: "# Head\n\n- One item\n- And another\n\n1. Numbered\n",
            across: Self.measure,
        )
        #expect(Self.kinds(of: placed) == [.heading, .body, .body, .body])
    }

    @Test
    func `the ramp sets a heading over the prose it introduces`() {
        let voicing = ProseVoicing.ramp(Self.palette.text)
        #expect(voicing.heading == Self.palette.text.ink(.title))
        #expect(voicing.body == Self.palette.text.ink(.body))
        #expect(voicing.heading != voicing.body)
    }

    /// The feed's own reading, and a deliberate value rather than the absence of one: a message
    /// is already at the top of the ramp, and a thought whose headings brightened would stop
    /// reading as a thought.
    @Test
    func `one tone sets a heading no louder than the words under it`() {
        let voicing = ProseVoicing.one(Self.palette.text.ink(.metadata))
        #expect(voicing.heading == voicing.body)
    }

    @Test
    func `an inking draws in the voice it was voiced with`() {
        let ink = Self.ink
        #expect(ink.voiced(.heading).voice.ink == Self.palette.text.primary)
        #expect(ink.voiced(.body).voice.ink == Self.palette.text.secondary)
        #expect(ink.voiced(.marker).voice.ink == Self.palette.text.tertiary)
    }

    /// Every kind draws in an ink somebody named, so no block can fall through to a voice nobody
    /// picked — and none of them is the `disabled` rung, which carries no contrast floor (#1250).
    @Test
    func `every voice is a rung live text is allowed on`() {
        for kind in ProseBlockKind.allCases {
            #expect(Self.ink.voiced(kind).voice.ink != Self.palette.text.disabled)
        }
    }

    /// The blocks the surface itself inks, in the order they are drawn. A block that lays itself
    /// out is drawn by its own view and takes no voice from here.
    private static func kinds(of placed: FeedProseFrame) -> [ProseBlockKind] {
        placed.parts.compactMap { part in
            guard case let .words(_, _, _, kind) = part.part else { return nil }
            return kind
        }
    }

    private static var ink: ProseInk {
        ProseInk(
            voices: ProseVoices(
                heading: ProseVoice(ink: palette.text.primary),
                body: ProseVoice(ink: palette.text.secondary),
                marker: ProseVoice(ink: palette.text.tertiary),
            ),
            link: palette.interaction.accent,
            marked: ProseMarkedInk(
                ground: palette.surface.marked,
                inset: CGSize(
                    width: ArgoFeedRow.markedSpanInsetX,
                    height: ArgoFeedRow.markedSpanInsetY,
                ),
                radius: ArgoRadius.marker,
            ),
        )
    }
}
