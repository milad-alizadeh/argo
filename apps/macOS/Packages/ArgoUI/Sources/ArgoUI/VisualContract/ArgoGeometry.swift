import SwiftUI

/// Corner radii. Four rungs, each tied to a kind of surface rather than to a number, so a
/// view picks the rung by asking what it is.
public enum ArgoRadius {
    /// A status dot's pill, a keyboard hint, anything small enough that a larger radius
    /// would read as a circle.
    public static let marker: CGFloat = 3
    /// Buttons, fields, chips.
    public static let control: CGFloat = 6
    /// A bounded Liquid Glass vessel in the toolbar.
    public static let vessel: CGFloat = 11
    /// Popovers and the inspection surface.
    public static let popover: CGFloat = 12
    /// The Instrument Deck is flush to the window — it is not a floating card.
    public static let deck: CGFloat = 0
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
}

/// The spacing rhythm. Dense by design: the cockpit shows many Sessions at once.
public enum ArgoSpacing {
    public static let hair: CGFloat = 2
    public static let tight: CGFloat = 4
    public static let snug: CGFloat = 6
    public static let base: CGFloat = 8
    public static let comfortable: CGFloat = 12
    public static let loose: CGFloat = 16
    public static let section: CGFloat = 24
    public static let region: CGFloat = 32

    public static let all: [(name: String, value: CGFloat)] = [
        ("hair", hair), ("tight", tight), ("snug", snug), ("base", base),
        ("comfortable", comfortable), ("loose", loose), ("section", section), ("region", region),
    ]
}
