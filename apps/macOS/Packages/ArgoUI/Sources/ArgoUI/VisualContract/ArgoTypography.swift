import SwiftUI

/// Which of the two system families a role is set in. Named rather than inlined as a
/// `Font.Design` so the contract can assert where each family is allowed to appear — the
/// sans/mono split is the rule most easily broken by a hurried view.
public enum ArgoTypeface: Sendable, CaseIterable {
    /// SF Pro. Everything the interface says in its own voice, identity lines included.
    case interface
    /// SF Mono. Machine facts: branches, SHAs, paths, counts, command text.
    case machine

    var design: Font.Design {
        switch self {
        case .interface: .default
        case .machine: .monospaced
        }
    }
}

public struct ArgoTextStyle: Sendable {
    public let typeface: ArgoTypeface
    public let size: CGFloat
    public let weight: Font.Weight
    public let tracking: CGFloat

    public init(
        typeface: ArgoTypeface,
        size: CGFloat,
        weight: Font.Weight,
        tracking: CGFloat = 0,
    ) {
        self.typeface = typeface
        self.size = size
        self.weight = weight
        self.tracking = tracking
    }

    public var font: Font {
        .system(size: size, weight: weight, design: typeface.design)
    }

    /// The size a symbol beside this role's label is drawn at.
    ///
    /// An SF Symbol takes the full point size of the text it sits next to, which puts its cap
    /// well above the label's — at the cockpit's 11–13pt the mark reads as standing proud of its
    /// own line. Scaled here it sits on the line instead, which is what makes a row read as one
    /// line of type with a mark on it rather than as an icon with a caption.
    public var glyphSize: CGFloat {
        size * ArgoTypography.glyphScale
    }

    public var glyphFont: Font {
        .system(size: glyphSize, weight: weight)
    }
}

/// The type hierarchy. Sizes are fixed rather than text-style-relative: the cockpit is a
/// dense observation surface where a Session row, a machine fact and a feed line have to
/// stay in a shared rhythm.
public enum ArgoTypography {
    /// A symbol is drawn at this fraction of its label's size — see `ArgoTextStyle.glyphSize`.
    /// One value for every glyph in the interface, so no call site decides how big a mark is.
    public static let glyphScale: CGFloat = 0.85

    /// The largest line in the cockpit: a Session's own title.
    public static let sessionTitle = ArgoTextStyle(
        typeface: .interface,
        size: 20,
        weight: .semibold,
    )
    /// A rare identity heading — a Project name, an empty-state title.
    public static let identityHeading = ArgoTextStyle(
        typeface: .interface,
        size: 15,
        weight: .semibold,
    )

    /// Sidebar and rail group labels.
    public static let sectionLabel = ArgoTextStyle(
        typeface: .interface, size: 11, weight: .semibold, tracking: 0.6,
    )
    /// A Session row's primary line.
    public static let rowTitle = ArgoTextStyle(typeface: .interface, size: 13, weight: .medium)
    /// The one quiet metadata line under it.
    public static let rowMeta = ArgoTextStyle(typeface: .interface, size: 11, weight: .regular)
    public static let body = ArgoTextStyle(typeface: .interface, size: 13, weight: .regular)
    /// Toolbar and vessel controls.
    public static let control = ArgoTextStyle(typeface: .interface, size: 12, weight: .medium)
    public static let caption = ArgoTextStyle(typeface: .interface, size: 11, weight: .regular)

    /// Branch, HEAD, elapsed, token counts.
    public static let machine = ArgoTextStyle(typeface: .machine, size: 11.5, weight: .regular)
    public static let machineEmphasis = ArgoTextStyle(
        typeface: .machine,
        size: 11.5,
        weight: .medium,
    )
    public static let machineCaption = ArgoTextStyle(
        typeface: .machine,
        size: 10.5,
        weight: .regular,
    )

    /// Every role, for contract assertions and the specimen.
    public static let all: [(name: String, style: ArgoTextStyle)] = [
        ("sessionTitle", sessionTitle),
        ("identityHeading", identityHeading),
        ("sectionLabel", sectionLabel),
        ("rowTitle", rowTitle),
        ("rowMeta", rowMeta),
        ("body", body),
        ("control", control),
        ("caption", caption),
        ("machine", machine),
        ("machineEmphasis", machineEmphasis),
        ("machineCaption", machineCaption),
    ]
}

public extension View {
    /// Applies a role's font and its tracking together — tracking is part of the role, and
    /// `.font()` alone silently drops it.
    func argoText(_ style: ArgoTextStyle) -> some View {
        font(style.font).tracking(style.tracking)
    }

    /// Draws a symbol at the size the role's own line height wants.
    func argoGlyph(_ style: ArgoTextStyle) -> some View {
        font(style.glyphFont)
    }
}

/// A symbol drawn exactly one label-line high, whatever box the symbol itself is drawn to.
///
/// Point size alone cannot settle this: `folder` is drawn to cap height while
/// `arrow.triangle.branch` fills its em box, so at one font size they stand a head apart in the
/// same bar. The frame is the contract's glyph size, so every mark in a line measures the same.
public struct ArgoGlyph: View {
    private let symbol: String
    private let style: ArgoTextStyle

    public init(_ symbol: String, _ style: ArgoTextStyle) {
        self.symbol = symbol
        self.style = style
    }

    public var body: some View {
        Image(systemName: symbol)
            .resizable()
            .scaledToFit()
            .frame(width: style.glyphSize, height: style.glyphSize)
    }
}

/// A label that draws its symbol beside its title, at the contract's rhythm.
///
/// It draws BOTH halves, deliberately: `.labelStyle(.titleAndIcon)` says what should be drawn and
/// leaves the decision to whatever control is hosting the label — and a segmented `Picker` answers
/// by dropping the image, so an icon declared in the model never reaches the screen.
///
/// The icon is laid out, not sized: a label built with `ArgoGlyph` already measures one line, and
/// one built with a bare `Image` takes the role's glyph font.
public struct ArgoLabelStyle: LabelStyle {
    let style: ArgoTextStyle

    public func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: ArgoSpacing.tight) {
            configuration.icon.argoGlyph(style)
            configuration.title.argoText(style)
        }
    }
}

public extension LabelStyle where Self == ArgoLabelStyle {
    static func argo(_ style: ArgoTextStyle) -> ArgoLabelStyle {
        ArgoLabelStyle(style: style)
    }
}
