import SwiftUI

/// A symbol drawn at exactly one rung of the icon scale, whatever box the symbol itself is drawn
/// to.
///
/// Point size alone cannot settle this: `folder` is drawn to cap height while
/// `arrow.triangle.branch` fills its em box, so at one font size they stand a head apart in the
/// same bar. The frame is the rung, so every mark on a rung measures the same.
struct ArgoGlyph: View {
    private let symbol: String
    private let size: ArgoIconSize

    init(_ symbol: String, _ size: ArgoIconSize) {
        self.symbol = symbol
        self.size = size
    }

    /// HEIGHT only, never a square. A square frame plus `scaledToFit` pins whichever dimension
    /// runs out first, which is the WIDTH for a wide mark like `folder` and the height for a tall
    /// narrow one like the branch — so one frame produced two ink heights, and the branch mark
    /// stood half again as tall as the folder beside it. Constraining height alone is what a rung
    /// means: every mark's ink measures the same, width follows.
    /// `fixedSize` is load-bearing too: a height-only frame leaves the WIDTH unbounded, and
    /// `scaledToFit` then grows the mark into whatever room the stack has going spare — which blew
    /// the disclosure chevron up to twice the folder beside it. Fixed, it takes the intrinsic
    /// width for that height, which is the whole point.
    var body: some View {
        Image(systemName: symbol)
            .resizable()
            .scaledToFit()
            .frame(height: size.rawValue)
            // Horizontal ONLY. Fixing both axes fights the explicit height above it, and the
            // unsatisfiable pair took the row's body down rather than laying anything out.
            .fixedSize(horizontal: true, vertical: false)
    }
}

// The two kinds of mark the frame has to reconcile, on one line, at one rung. `folder` is drawn
// to cap height and the branch mark to its em box — the pair this type exists for.
#Preview("Glyphs — a cap-height mark and an em-box mark on one line") {
    HStack(spacing: ArgoSpacing.base) {
        ArgoGlyph(ArgoSymbol.project, .control)
        ArgoGlyph(ArgoSymbol.branch, .control)
        ArgoGlyph(ArgoSymbol.disclosure, .indicator)
        Text("argo · main")
            .argoText(ArgoTypography.control)
    }
    .padding(ArgoSpacing.region)
    .argoAppearance()
}

#Preview("Glyphs — the whole scale, against the line each rung sits on") {
    VStack(alignment: .leading, spacing: ArgoSpacing.base) {
        ForEach(ArgoIconSize.ladder, id: \.name) { rung in
            HStack(spacing: ArgoSpacing.base) {
                ArgoGlyph(ArgoSymbol.project, rung.size)
                Text(rung.name)
                    .argoText(ArgoTypography.body)
            }
        }
    }
    .padding(ArgoSpacing.region)
    .argoAppearance()
}
