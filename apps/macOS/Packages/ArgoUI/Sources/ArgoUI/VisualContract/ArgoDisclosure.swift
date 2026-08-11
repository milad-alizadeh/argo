import SwiftUI

/// The cockpit's one disclosure chevron: one symbol, one rung, and the direction it opens taken by
/// ROTATION rather than by a second symbol.
///
/// One shape because the scale constrains a mark's HEIGHT (`ArgoGlyph`): `chevron.down` held to a
/// rung is that tall and half again as wide, so a down-chevron drawn as its own symbol came out the
/// widest mark on a line meant to be quiet. Rotated, every chevron in the app is the same ink, and
/// a control that reports its state by angle animates rather than swapping symbols mid-turn.
struct ArgoDisclosure: View {
    /// Where what it opens lands, which is the only thing that turns the mark.
    enum Opens {
        /// A panel beside it — a feed row's evidence.
        case beside
        /// A menu or a drawer under it, and an accordion that has been opened.
        case below

        var angle: Angle {
            switch self {
            case .beside: .zero
            case .below: .degrees(90)
            }
        }
    }

    let opens: Opens

    init(_ opens: Opens) {
        self.opens = opens
    }

    var body: some View {
        ArgoGlyph(ArgoSymbol.disclosure, .chevron)
            .rotationEffect(opens.angle)
    }
}

#Preview("Disclosure — both directions, against the line each sits on") {
    VStack(alignment: .leading, spacing: ArgoSpacing.base) {
        HStack(spacing: ArgoSpacing.snug) {
            ArgoDisclosure(.beside)
            Text("Opens beside").argoText(ArgoTypography.caption)
        }
        HStack(spacing: ArgoSpacing.snug) {
            ArgoDisclosure(.below)
            Text("Opens below").argoText(ArgoTypography.control)
        }
    }
    .padding(ArgoSpacing.region)
    .argoAppearance()
}
