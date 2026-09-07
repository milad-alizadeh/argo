import ArgoDesign
import SwiftUI

/// How loud a block of prose is set: the rung its running words take, and the rung the headings
/// IN them take.
///
/// Two, because a heading is not the paragraph under it — a renderer with one voice drew a
/// tracker's `##` in the same grey as the prose it introduced (#1597). Which rungs those are is
/// the calling surface's decision and never the renderer's.
package struct ProseVoicing: Equatable {
    /// A paragraph, a list item's words, a table's cells.
    package var body: ArgoColor
    /// A `#` through `######` line the writer put in the prose.
    package var heading: ArgoColor

    /// The ramp's own answer: prose one rung under the headings over it, which is the pairing
    /// `ArgoLineKind` already holds for `.body` and `.title`. What a ticket's body is voiced with,
    /// and what a pane's own headings beside it are already drawn in.
    package static func ramp(_ text: ArgoPalette.TextRoles) -> ProseVoicing {
        ProseVoicing(body: text.ink(.body), heading: text.ink(.title))
    }

    /// One tone for every block. For a reading whose whole voice is the point — the feed's — where
    /// a heading louder than the words around it would say something the block does not mean.
    package static func one(_ ink: ArgoColor) -> ProseVoicing {
        ProseVoicing(body: ink, heading: ink)
    }
}

package extension EnvironmentValues {
    /// How the prose of the current block is voiced.
    ///
    /// Read by the markdown renderer, which inks each block in the voice its kind is owed, and by
    /// a marked `code` span, to find out whether inheriting would put it under the contrast floor
    /// on its own ground. `nil` means nobody claimed a voice: the renderer falls back to one tone
    /// at the loudest rung, and a span inherits with the floor never engaging.
    @Entry var proseVoice: ProseVoicing?
}
