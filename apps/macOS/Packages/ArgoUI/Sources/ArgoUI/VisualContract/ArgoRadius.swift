import SwiftUI

/// Corner radii, one rung per kind of surface.
///
/// There is deliberately **no rung for a toolbar vessel**: a bounded Liquid Glass vessel takes its
/// shape from the toolbar's own material, so a view drawing such a radius draws a second shape
/// inside the system's.
public enum ArgoRadius {
    /// A status dot's pill, a keyboard hint, anything small enough that a larger radius
    /// would read as a circle. Also a marked `code` span's ground.
    public static let marker: CGFloat = 3
    /// Buttons, fields, chips.
    public static let control: CGFloat = 6
    /// Popovers and the inspection surface.
    public static let popover: CGFloat = 12
    /// The Instrument Deck is flush to the window. Worth zero and referenced by nothing: a view
    /// honours it by drawing no corner at all.
    public static let deck: CGFloat = 0

    /// Every rung, for the specimen and its coverage check.
    public static let all: [(name: String, radius: CGFloat)] = [
        ("marker", marker), ("control", control), ("popover", popover), ("deck", deck),
    ]
}
