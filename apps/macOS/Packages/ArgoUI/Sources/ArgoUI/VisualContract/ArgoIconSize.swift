import SwiftUI

/// Every size a symbol is drawn at. Two rungs, and adding a third is a decision, not a reflex.
///
/// The rungs are absolute rather than relative to the label beside them, so a mark is the same size
/// wherever it appears. The contract asserts the ceiling that keeps one from standing proud of its
/// line: no rung outgrows the densest text role it may sit next to.
public enum ArgoIconSize: CGFloat, Sendable, CaseIterable {
    /// A disclosure chevron, and nothing else. The only rung below the `inline` floor: a chevron
    /// annotates a control the reader already found by its label.
    case chevron = 8
    /// A mark on a line of text — a feed row's kind, a lock on a roster row, a branch beside its
    /// name. The right answer unless the mark IS the control, or it is a chevron.
    case inline = 10
    /// A control's own mark, where the mark is the thing being pointed at rather than a note beside
    /// something else: a toolbar vessel, an icon-only button.
    case control = 13

    var font: Font {
        .system(size: rawValue)
    }

    /// The rungs in order, for the contract's assertions and the specimen.
    public static let ladder: [(name: String, size: ArgoIconSize)] = [
        ("chevron", .chevron), ("inline", .inline), ("control", .control),
    ]
}

public extension View {
    /// Draws a symbol at a rung of the scale. For a bare `Image`; a mark on a line of type wants
    /// `ArgoGlyph`, which also settles the two ways SF draws a symbol's box.
    func argoIcon(_ size: ArgoIconSize) -> some View {
        font(size.font)
    }
}
