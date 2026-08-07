import SwiftUI

/// A symbol drawn exactly one label-line high, whatever box the symbol itself is drawn to.
///
/// Point size alone cannot settle this: `folder` is drawn to cap height while
/// `arrow.triangle.branch` fills its em box, so at one font size they stand a head apart in the
/// same bar. The frame is the contract's glyph size, so every mark in a line measures the same.
struct ArgoGlyph: View {
    private let symbol: String
    private let style: ArgoTextStyle

    init(_ symbol: String, _ style: ArgoTextStyle) {
        self.symbol = symbol
        self.style = style
    }

    var body: some View {
        Image(systemName: symbol)
            .resizable()
            .scaledToFit()
            .frame(width: style.glyphSize, height: style.glyphSize)
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
