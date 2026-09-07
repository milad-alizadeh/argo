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
        let voicing = ProseTone.ramp(Self.palette.text)
        #expect(voicing.heading == Self.palette.text.ink(.title))
        #expect(voicing.body == Self.palette.text.ink(.body))
        #expect(voicing.heading != voicing.body)
    }

    /// The feed's own reading, and a deliberate value rather than the absence of one: a message
    /// is already at the top of the ramp, and a thought whose headings brightened would stop
    /// reading as a thought.
    @Test
    func `one tone sets a heading no louder than the words under it`() {
        let voicing = ProseTone.one(Self.palette.text.ink(.metadata))
        #expect(voicing.heading == voicing.body)
    }

    @Test
    func `an inking draws in the voice it was voiced with`() {
        let ink = Self.ink
        #expect(ink.voiced(.heading).voice.ink == Self.palette.text.ink(.title))
        #expect(ink.voiced(.body).voice.ink == Self.palette.text.ink(.body))
        #expect(ink.voiced(.marker).voice.ink == Self.palette.text.ink(.metadata))
    }

    /// Every kind draws in an ink somebody named, so no block can fall through to a voice nobody
    /// picked — and none of them is the `disabled` rung, which carries no contrast floor (#1250).
    ///
    /// Over both tones a surface actually passes, and over the ink they produce rather than a
    /// fixture beside them: a rung that reached a block would reach it through one of these.
    @Test
    func `every voice a tone produces is a rung live text is allowed on`() {
        let tones = [ProseTone.ramp(Self.palette.text), .one(Self.palette.text.ink(.title))]
        for tone in tones {
            for kind in ProseVoiceKind.allCases {
                let voice = tone.inked(Self.palette).voiced(kind).voice
                #expect(voice.ink != Self.palette.text.ink(.disabled))
                #expect(voice.span != Self.palette.text.ink(.disabled))
            }
        }
    }

    /// The blocks the surface itself inks, in the order they are drawn. A block that lays itself
    /// out is drawn by its own view and takes no voice from here.
    private static func kinds(of placed: FeedProseFrame) -> [ProseVoiceKind] {
        placed.parts.compactMap { part in
            guard case let .words(_, _, _, kind) = part.part else { return nil }
            return kind
        }
    }

    /// The ink the ticket detail's own tone produces, through the function that ships it.
    private static var ink: ProseInk {
        ProseTone.ramp(palette.text).inked(palette)
    }
}
