import AppKit
import ArgoDesign
import ProseText

/// What a PROSE row stands at, typeset rather than laid out.
///
/// A height off a hosting ruler is a full SwiftUI layout pass, and the minimap needs one for EVERY
/// row of the document rather than for the ones on screen — so a 4 000-row reading paid 4 000
/// layout passes before it settled (#856). The count cannot come down; this brings the cost down
/// instead, by asking Core Text, which is where the glyphs come from either way. Recorded at 2.9×
/// cheaper a row, and what is left of a prose measure is the markdown read the drawn cell pays
/// anyway (`FeedTypesetCostTests`).
///
/// It is not a second model of the row, and since ADR-0030 Rule 2 it is not a second LAYOUT of it
/// either: the answer is `FeedProseFrame`'s, which is the very frame `ProseSurface` inks. Height
/// equals drawn by construction — there is one walk over one typeset, and this name is where the
/// rest of the feed asks it for a number.
///
/// It answers for every prose row and declines nothing (ADR-0030, Rule 1): a table and a diagram
/// size THEMSELVES, so each is taken at the height its own layout gives it rather than rounded like
/// a line of glyphs.
enum FeedRowMeasure {
    /// The column a row's own words wrap across, at a table this wide — `argoFeedMeasure`'s cap and
    /// the row's gutters, which is the pair `FeedTableModel.content(at:)` applies in that order.
    static func measure(atWidth width: CGFloat) -> CGFloat {
        max(0, min(width, ArgoFeedRow.column) - ArgoFeedRow.inset * 2)
    }

    /// What a block of the agent's own words stands at.
    ///
    /// `chip` rather than the offer itself: the height a chip takes is the same whatever it hands
    /// over, and resolving the words is a walk over the row's whole Turn.
    static func height(ofProse words: String, chip: Bool, across measure: CGFloat) -> CGFloat {
        // `FeedProseFrame.of` and not `ProseReading.frame`: this is asked by the whole-document
        // measure pass, off the main actor, and the store behind that name is the main actor's —
        // a placed frame holds the `CTLine`s it was placed from (`ProseStore`). The two are the
        // same pure function over the same string at the same measure, so the height a row is set
        // to and the frame the surface inks are still one answer (ADR-0030, Rule 2).
        FeedProseFrame.of(text: words, across: measure).height
            + (chip ? FeedProseFrame.chipHeight : 0)
    }
}
