import SwiftUI

/// Corner radii. Each rung is tied to a kind of surface rather than to a number, so a view picks
/// the rung by asking what it is.
///
/// There is deliberately **no rung for a toolbar vessel.** One existed, at 11pt, and nothing could
/// ever apply it: a bounded Liquid Glass vessel takes its shape from the toolbar's own material,
/// and a view that drew this radius would be drawing a second shape inside the system's. A number
/// that looks like a decision and cannot be honoured is worse than an absence, which is why this
/// paragraph is here instead of the value.
public enum ArgoRadius {
    /// A status dot's pill, a keyboard hint, anything small enough that a larger radius
    /// would read as a circle. Also a marked `code` span's ground.
    public static let marker: CGFloat = 3
    /// Buttons, fields, chips.
    public static let control: CGFloat = 6
    /// Popovers and the inspection surface.
    public static let popover: CGFloat = 12
    /// The Instrument Deck is flush to the window — it is not a floating card.
    ///
    /// Worth zero and kept anyway: nothing references it, because the way a view honours it is by
    /// drawing no corner at all. What it buys is the difference between a deck that is flat
    /// BECAUSE SOMEBODY DECIDED and a deck that is flat because nobody thought about it.
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
    /// The dash a broken edge is drawn with: a Project whose folder is not there. Shape carries
    /// what the row also says in words, so neither reading stands alone.
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
