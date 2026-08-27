import SwiftUI

/// A name with the glyph that says what KIND of thing it names, drawn as one group.
///
/// Cut in the MIDDLE, always: every name this draws is addressed from both ends — a branch by the
/// ticket number at its head and the slug at its tail. The middle is the part that repeats.
///
/// The glyph is optional because an absent one is a real rendering: where Argo has not read what
/// kind of thing this is, drawing the plain glyph would claim it is the other kind.
///
/// Ink is the caller's: the group takes whatever `foregroundStyle` it is placed in, so the glyph
/// and the words can never end up two colours.
struct ArgoKindedName: View {
    let symbol: String?
    let name: String
    let style: ArgoTextStyle

    var body: some View {
        HStack(spacing: ArgoSpacing.tight) {
            if let symbol {
                ArgoGlyph(symbol, .inline)
            }
            Text(name)
                .argoText(style)
                .lineLimit(1)
                .truncationMode(.middle)
        }
    }
}

#Preview("Kinded name — with a glyph, without one, and cut") {
    VStack(alignment: .leading, spacing: ArgoSpacing.base) {
        ArgoKindedName(
            symbol: ArgoSymbol.branch,
            name: "argo/#551-session-row-meta-order",
            style: ArgoTypography.machineCaption,
        )
        ArgoKindedName(
            symbol: ArgoSymbol.worktree,
            name: "ticket-551-session-row-meta-order-worktree",
            style: ArgoTypography.rowMeta,
        )
        ArgoKindedName(
            symbol: nil,
            name: "a checkout of an unread kind",
            style: ArgoTypography.rowMeta,
        )
    }
    .frame(width: 220, alignment: .leading)
    .padding(ArgoSpacing.region)
    .argoAppearance()
}
