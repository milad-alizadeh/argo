import SwiftUI

/// A label that draws its symbol beside its title, at the contract's rhythm.
///
/// It draws BOTH halves, deliberately: `.labelStyle(.titleAndIcon)` says what should be drawn and
/// leaves the decision to whatever control is hosting the label — and a segmented `Picker` answers
/// by dropping the image, so an icon declared in the model never reaches the screen.
///
/// The icon is laid out, not sized: a label built with `ArgoGlyph` already measures one line, and
/// one built with a bare `Image` takes the role's glyph font.
struct ArgoLabelStyle: LabelStyle {
    let style: ArgoTextStyle

    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: ArgoSpacing.tight) {
            configuration.icon.argoGlyph(style)
            configuration.title.argoText(style)
        }
    }
}

extension LabelStyle where Self == ArgoLabelStyle {
    static func argo(_ style: ArgoTextStyle) -> ArgoLabelStyle {
        ArgoLabelStyle(style: style)
    }
}

#Preview("Label style — an ArgoGlyph icon and a bare Image icon") {
    VStack(alignment: .leading, spacing: ArgoSpacing.base) {
        Label {
            Text("Framed to the line")
        } icon: {
            ArgoGlyph(ArgoSymbol.branch, ArgoTypography.control)
        }
        Label("Sized by the role's glyph font", systemImage: ArgoSymbol.project)
    }
    .labelStyle(.argo(ArgoTypography.control))
    .padding(ArgoSpacing.region)
    .argoAppearance()
}
