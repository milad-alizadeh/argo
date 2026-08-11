import SwiftUI

/// How far off its ground a surface sits. Almost every rung is flat: depth comes from material,
/// edges and tone, and a shadow is reserved for surfaces that genuinely float free of the plane.
public struct ArgoElevation: Sendable {
    public let blur: CGFloat
    public let yOffset: CGFloat
    public let opacity: Double

    public init(blur: CGFloat, yOffset: CGFloat, opacity: Double) {
        self.blur = blur
        self.yOffset = yOffset
        self.opacity = opacity
    }

    public var castsShadow: Bool {
        opacity > 0
    }
}

public extension ArgoElevation {
    /// In the plane. Rows, rails, the feed.
    static let flat = ArgoElevation(blur: 0, yOffset: 0, opacity: 0)
    /// The Instrument Deck: separated by tone and a hairline, never by a shadow.
    static let deck = ArgoElevation(blur: 0, yOffset: 0, opacity: 0)
    /// A bounded glass vessel: the specular rim is the depth cue.
    static let vessel = ArgoElevation(blur: 0, yOffset: 0, opacity: 0)
    /// A popover or menu — genuinely above the window's plane.
    static let popover = ArgoElevation(blur: 18, yOffset: 8, opacity: 0.34)
    /// Something under the pointer, torn out of its row.
    static let dragged = ArgoElevation(blur: 24, yOffset: 10, opacity: 0.40)

    static let all: [(name: String, elevation: ArgoElevation)] = [
        ("flat", flat), ("deck", deck), ("vessel", vessel),
        ("popover", popover), ("dragged", dragged),
    ]

    /// Roles nothing draws yet. See `ArgoMotion.unwired` for why they stay and why they say so.
    ///
    /// The three zero rungs are NOT here: nothing references them either, but a flat surface
    /// drawing no shadow is what honouring them looks like.
    static let unwired: [String: String] = ["dragged": "drag-and-drop"]
}

public extension View {
    func argoShadow(_ elevation: ArgoElevation) -> some View {
        shadow(
            color: .black.opacity(elevation.opacity),
            radius: elevation.blur,
            y: elevation.yOffset,
        )
    }
}
