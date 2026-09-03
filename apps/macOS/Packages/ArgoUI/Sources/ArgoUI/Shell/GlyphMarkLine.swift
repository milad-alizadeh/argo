import ArgoAtoms
import ArgoDesign
import SwiftUI

/// One glyph and one line of text, both in the ink the caller names — the shape a claimant line
/// and an issue link both draw, whether the line is a route or a reading. Shared rather than
/// pasted twice: `TicketClaimantLine` and `SessionIssueLink` are the two callers (#1092).
struct GlyphMarkLine: View {
    let symbol: String
    let text: String
    let ink: ArgoColor

    var body: some View {
        HStack(spacing: ArgoSpacing.tight) {
            ArgoGlyph(symbol, .inline)
                .foregroundStyle(ink)
                .accessibilityHidden(true)
            Text(text)
                .argoText(ArgoTypography.rowMeta)
                .foregroundStyle(ink)
                .lineLimit(1)
        }
    }
}
