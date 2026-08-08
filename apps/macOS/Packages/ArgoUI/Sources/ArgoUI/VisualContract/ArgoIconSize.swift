import SwiftUI

/// Every size a symbol is drawn at. Three rungs, and adding a fourth is a decision, not a reflex.
///
/// It replaces a multiplier on the type ramp. That rule — a mark is 0.85 of its label — sounds
/// principled and produced ELEVEN icon sizes, one per role, differing from each other by fractions
/// of a point: two marks on adjacent rows were never the same size and nobody could have said why.
/// A scale this short is picked by MEANING, because there is no near-miss to pick by proximity.
///
/// The rungs are absolute rather than relative to the label beside them, so a mark is the same
/// size wherever it appears. What keeps one from standing proud of its line is the ceiling the
/// contract asserts: no rung outgrows the densest text role it may sit next to.
public enum ArgoIconSize: CGFloat, Sendable, CaseIterable {
    /// Points at something and names nothing: a disclosure chevron, a caret. Well under the text
    /// beside it on purpose — it is punctuation, and at label size it reads as a word.
    case indicator = 6
    /// A mark on a line of text — a feed row's kind, a lock on a roster row, a branch beside its
    /// name. The workhorse, and the right answer unless the mark IS the control.
    case inline = 10
    /// A control's own mark, where the mark is the thing being pointed at rather than a note
    /// beside something else: a toolbar vessel, an icon-only button.
    case control = 13

    var font: Font {
        .system(size: rawValue)
    }

    /// The rungs in order, for the contract's assertions and the specimen.
    public static let ladder: [(name: String, size: ArgoIconSize)] = [
        ("indicator", .indicator), ("inline", .inline), ("control", .control),
    ]
}

public extension View {
    /// Draws a symbol at a rung of the scale. For a bare `Image`; `ArgoGlyph` is what a mark on a
    /// line of type wants, because it also settles the two ways SF draws a symbol's box.
    func argoIcon(_ size: ArgoIconSize) -> some View {
        font(size.font)
    }
}
