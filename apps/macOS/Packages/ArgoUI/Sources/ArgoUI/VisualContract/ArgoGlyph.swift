import SwiftUI

/// A symbol drawn exactly one label-line high, whatever box the symbol itself is drawn to.
///
/// Point size alone cannot settle this: `folder` is drawn to cap height while
/// `arrow.triangle.branch` fills its em box, so at one font size they stand a head apart in the
/// same bar. The frame is the contract's glyph size, so every mark in a line measures the same.
struct ArgoGlyph: View {
    private let symbol: String
    private let style: ArgoTextStyle

    private let height: CGFloat?

    init(_ symbol: String, _ style: ArgoTextStyle) {
        self.symbol = symbol
        self.style = style
        self.height = nil
    }

    /// An indicator, not a label glyph. A disclosure carries no meaning of its own — it says the
    /// control opens — so matching it to the line height of the words beside it makes a chevron
    /// wider than the Project mark it points at. It takes its own measure.
    init(indicator symbol: String, height: CGFloat) {
        self.symbol = symbol
        self.style = ArgoTypography.machineCaption
        self.height = height
    }

    /// HEIGHT only, never a square. A square frame plus `scaledToFit` pins whichever dimension
    /// runs out first, which is the WIDTH for a wide mark like `folder` and the height for a tall
    /// narrow one like the branch — so one frame produced two ink heights, and the branch mark
    /// stood half again as tall as the folder beside it. Constraining height alone is what "sized
    /// off the label's line height" means: every mark's ink measures the same, width follows.
    /// `fixedSize` is load-bearing too: a height-only frame leaves the WIDTH unbounded, and
    /// `scaledToFit` then grows the mark into whatever room the stack has going spare — which blew
    /// the disclosure chevron up to twice the folder beside it. Fixed, it takes the intrinsic
    /// width for that height, which is the whole point.
    var body: some View {
        Image(systemName: symbol)
            .resizable()
            .scaledToFit()
            .frame(height: height ?? style.glyphSize)
            // Horizontal ONLY. Fixing both axes fights the explicit height above it, and the
            // unsatisfiable pair took the row's body down rather than laying anything out.
            .fixedSize(horizontal: true, vertical: false)
    }
}

// The two kinds of mark the frame has to reconcile, on one line, at one role. `folder` is drawn
// to cap height and the branch mark to its em box — the pair this type exists for.
#Preview("Glyphs — a cap-height mark and an em-box mark on one line") {
    HStack(spacing: ArgoSpacing.base) {
        ArgoGlyph(ArgoSymbol.project, ArgoTypography.control)
        ArgoGlyph(ArgoSymbol.branch, ArgoTypography.control)
        ArgoGlyph(ArgoSymbol.disclosure, ArgoTypography.control)
        Text("argo · main")
            .argoText(ArgoTypography.control)
    }
    .padding(ArgoSpacing.region)
    .argoAppearance()
}

#Preview("Glyphs — every role's own size") {
    VStack(alignment: .leading, spacing: ArgoSpacing.base) {
        ForEach(ArgoTypography.all, id: \.name) { role in
            HStack(spacing: ArgoSpacing.base) {
                ArgoGlyph(ArgoSymbol.project, role.style)
                Text(role.name)
                    .argoText(role.style)
            }
        }
    }
    .padding(ArgoSpacing.region)
    .argoAppearance()
}
