import ArgoDesign
import SwiftUI

/// The cockpit's one disclosure chevron: one symbol, one rung, and the direction it opens taken by
/// ROTATION rather than by a second symbol.
///
/// One shape because `ArgoGlyph` constrains a mark's HEIGHT, so `chevron.down` at a rung is wider
/// than `chevron.right` turned — and a rotation can animate where a swap cannot.
public struct ArgoDisclosure: View {
    /// Where what it opens lands, which is the only thing that turns the mark.
    public enum Opens {
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

    public init(_ opens: Opens) {
        self.opens = opens
    }

    public var body: some View {
        ArgoGlyph(ArgoSymbol.disclosure, .chevron)
            .rotationEffect(opens.angle)
            // A rotation does not resize the box, so a turned mark paints its HEIGHT sideways and
            // overflows the narrow width the glyph reserved. Squared to the rung, it fits.
            .frame(width: ArgoIconSize.chevron.rawValue, height: ArgoIconSize.chevron.rawValue)
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
