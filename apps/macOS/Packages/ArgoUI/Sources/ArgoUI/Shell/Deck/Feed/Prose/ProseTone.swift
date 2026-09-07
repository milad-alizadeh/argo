import ArgoDesign
import ProseText
import SwiftUI

/// How loud a block of prose is set: the rung its running words take, and the rung the headings
/// IN them take.
///
/// Two, because a heading is not the paragraph under it (#1597). Which rungs those are is the
/// calling surface's decision and never the renderer's.
package struct ProseTone: Equatable {
    /// A paragraph, a list item's words, a table's cells.
    package var body: ArgoColor
    /// A `#` through `######` line the writer put in the prose.
    package var heading: ArgoColor

    /// The ramp's own answer: prose one rung under the headings over it, which is the pairing
    /// `ArgoLineKind` already holds for `.body` and `.title`.
    package static func ramp(_ text: ArgoPalette.TextRoles) -> ProseTone {
        ProseTone(body: text.ink(.body), heading: text.ink(.title))
    }

    /// One tone for every block, headings included. For a reading whose whole voice is the point
    /// — the feed's — where a heading louder than the words around it would say something the
    /// block does not mean.
    package static func one(_ ink: ArgoColor) -> ProseTone {
        ProseTone(body: ink, heading: ink)
    }

    /// The value the renderer draws from: a voice per kind, each floored against its own ink, and
    /// the marks a span takes whichever kind it sits in.
    ///
    /// Here rather than in the view, so the surface, the specimen and the suites all ink a row
    /// through the one function that ships.
    package func inked(_ color: ArgoPalette) -> ProseInk {
        ProseInk(
            voices: ProseVoices(
                heading: color.text.voiced(heading),
                body: color.text.voiced(body),
                // A list's marker is quieter than the words beside it — `FeedMarker`'s own rule.
                marker: color.text.voiced(color.text.ink(.metadata)),
            ),
            link: color.interaction.accent,
            marked: ProseMarkedInk(
                ground: color.surface.marked,
                inset: CGSize(
                    width: ArgoFeedRow.markedSpanInsetX,
                    height: ArgoFeedRow.markedSpanInsetY,
                ),
                radius: ArgoRadius.marker,
            ),
        )
    }
}

package extension ArgoPalette.TextRoles {
    /// One voice: an ink, and what a `code` span inside it is inked in — nothing at all, unless
    /// the voice around it would fall under the contrast floor once the span's ground lifts the
    /// backdrop out from under it. The choice itself is the palette's (`marked(on:)`).
    ///
    /// Floored per voice rather than once for the row: a span in a heading is read against the
    /// heading's own ink, which is the only ground it actually sits next to.
    func voiced(_ ink: ArgoColor) -> ProseVoice {
        let floored = marked(on: ink)
        return ProseVoice(ink: ink, span: floored == ink ? nil : floored)
    }
}

package extension EnvironmentValues {
    /// How the prose of the current block is voiced.
    ///
    /// Read by the markdown renderer, which inks each block in the voice its kind is owed, and by
    /// a marked `code` span, to find out whether inheriting would put it under the contrast floor
    /// on its own ground. `nil` means nobody claimed a tone: the renderer falls back to one at the
    /// loudest rung, and a span inherits with the floor never engaging.
    @Entry var proseTone: ProseTone?
}
