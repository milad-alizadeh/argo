import SwiftUI

/// A label that draws its symbol beside its title, at the contract's rhythm.
///
/// It draws BOTH halves, deliberately: `.labelStyle(.titleAndIcon)` says what should be drawn and
/// leaves the decision to whatever control is hosting the label — and a segmented `Picker` answers
/// by dropping the image, so an icon declared in the model never reaches the screen.
///
/// The two sizes are named separately because they answer to different scales: the words to the
/// type ramp, the mark to the icon scale. They were one number multiplied by 0.85, which is how
/// the app ended up with an icon size per type role.
struct ArgoLabelStyle: LabelStyle {
    let style: ArgoTextStyle
    let icon: ArgoIconSize

    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: ArgoSpacing.snug) {
            configuration.icon.argoIcon(icon)
            configuration.title.argoText(style)
        }
    }
}

extension LabelStyle where Self == ArgoLabelStyle {
    /// The mark defaults to `inline`, which is the rung a label's icon almost always wants: it
    /// sits beside words rather than standing in for them.
    static func argo(_ style: ArgoTextStyle, icon: ArgoIconSize = .inline) -> ArgoLabelStyle {
        ArgoLabelStyle(style: style, icon: icon)
    }
}

#Preview("Label style — an ArgoGlyph icon and a bare Image icon") {
    VStack(alignment: .leading, spacing: ArgoSpacing.base) {
        Label {
            Text("Framed to the rung")
        } icon: {
            ArgoGlyph(ArgoSymbol.branch, .inline)
        }
        Label("Sized by the label style's rung", systemImage: ArgoSymbol.project)
    }
    .labelStyle(.argo(ArgoTypography.control))
    .padding(ArgoSpacing.region)
    .argoAppearance()
}
