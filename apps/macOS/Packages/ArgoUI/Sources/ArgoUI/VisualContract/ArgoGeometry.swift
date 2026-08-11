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

/// Stroke widths. Every one of them is an edge, which is how depth is built here.
public enum ArgoStroke {
    /// A separator between two surfaces of the same tone.
    public static let hairline: CGFloat = 0.5
    /// A control border.
    public static let border: CGFloat = 1
    /// The Ion Blue selection edge on a row or a tab.
    public static let indicator: CGFloat = 2
    /// The keyboard focus ring.
    public static let focus: CGFloat = 2
    /// The dash a broken edge is drawn with: a Project whose folder is not there.
    public static let dash: CGFloat = 3
}

/// The spacing rhythm. Dense by design: the cockpit shows many Sessions at once.
public enum ArgoSpacing {
    public static let flush: CGFloat = 0
    public static let hair: CGFloat = 2
    public static let tight: CGFloat = 4
    public static let snug: CGFloat = 6
    public static let base: CGFloat = 8
    public static let comfortable: CGFloat = 12
    public static let loose: CGFloat = 16
    public static let section: CGFloat = 24
    public static let region: CGFloat = 32

    public static let all: [(name: String, value: CGFloat)] = [
        ("flush", flush), ("hair", hair), ("tight", tight), ("snug", snug), ("base", base),
        ("comfortable", comfortable), ("loose", loose), ("section", section), ("region", region),
    ]
}
