import SwiftUI

/// The type scale, which is Apple's: the macOS HIG text styles under the HIG's own names, so
/// Accessibility text-size settings already know how to scale them.
///
/// Rendering goes through the SEMANTIC style rather than a number, so a line takes Apple's metrics
/// and not a copy. `size` below is the documented macOS value, for line-height arithmetic only.
public enum ArgoTypeScale: Sendable, CaseIterable {
    case largeTitle
    case title1
    case title2
    case title3
    case headline
    case body
    case callout
    case subheadline
    case footnote
    case caption1
    case caption2

    var style: Font.TextStyle {
        switch self {
        case .largeTitle: .largeTitle
        case .title1: .title
        case .title2: .title2
        case .title3: .title3
        case .headline: .headline
        case .body: .body
        case .callout: .callout
        case .subheadline: .subheadline
        case .footnote: .footnote
        case .caption1: .caption
        case .caption2: .caption2
        }
    }

    /// The size the HIG's macOS table gives this style. Read, never set — the platform draws it.
    public var size: CGFloat {
        switch self {
        case .largeTitle: 26
        case .title1: 22
        case .title2: 17
        case .title3: 15
        case .headline, .body: 13
        case .callout: 12
        case .subheadline: 11
        case .footnote, .caption1, .caption2: 10
        }
    }

    /// What the system already sets a line at, as a multiple of its point size. SwiftUI has no
    /// line-height modifier: `lineSpacing` is the EXTRA leading on top of the font's own, so
    /// anything wanting a line to occupy a stated height does the subtraction itself.
    static let naturalLineHeightRatio: CGFloat = 1.21

    /// Every rung, largest first, for the specimen and the contract's assertions.
    public static let ladder: [(name: String, rung: ArgoTypeScale)] = [
        ("largeTitle", .largeTitle), ("title1", .title1), ("title2", .title2),
        ("title3", .title3), ("headline", .headline), ("body", .body), ("callout", .callout),
        ("subheadline", .subheadline), ("footnote", .footnote), ("caption1", .caption1),
        ("caption2", .caption2),
    ]
}

public extension View {
    /// A rung of the scale in the interface sans. The weight is Apple's unless one is named — a
    /// `headline` is bold because the HIG says so.
    func argoText(_ rung: ArgoTypeScale, _ weight: Font.Weight? = nil) -> some View {
        font(.system(rung.style, design: .default, weight: weight))
    }

    /// The same rung in the mono. Machine facts: a command, a path, a patch, a count.
    func argoMono(_ rung: ArgoTypeScale, _ weight: Font.Weight? = nil) -> some View {
        font(.system(rung.style, design: .monospaced, weight: weight))
    }
}
