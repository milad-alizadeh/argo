import SwiftUI

/// The one line pinned above a composer menu's list saying how a slower half of its catalog is
/// doing (#686, `cockpit-composer-picker.md` decisions 9 and 10): a mark, then the words, on a row
/// of the list's own height so the strip and the rows under it stand on one rhythm.
///
/// PINNED above the list rather than drawn where the section it speaks for would be. In its own
/// place it sits below ten rows of skills, where the reader about to conclude the CLI has no
/// `/compact` will never scroll to it.
struct ComposerMenuStatusLine: View {
    @Environment(\.argo) private var argo

    let status: ComposerMenu.Status

    var body: some View {
        HStack(spacing: ArgoSpacing.snug) {
            glyph
            Text(status.words)
                .argoText(ArgoTypography.rowMeta)
                .foregroundStyle(ink)
                .lineLimit(1)
                .truncationMode(.tail)
        }
        .padding(.horizontal, ArgoSpacing.base)
        .frame(height: ArgoComposerVessel.commandRowHeight, alignment: .leading)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder private var glyph: some View {
        switch status.mark {
        case .waiting:
            Circle()
                .fill(ink.color)
                .frame(width: ArgoLayout.statusDotSize, height: ArgoLayout.statusDotSize)
        case .failed:
            Image(systemName: ArgoSymbol.refused)
                .argoText(ArgoTypography.rowMeta)
                .foregroundStyle(ink)
        }
    }

    private var ink: ArgoColor {
        switch status.mark {
        case .waiting: argo.color.text.tertiary
        case .failed: argo.color.state.attention
        }
    }
}

#Preview("Composer menu status — every state") {
    VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
        ComposerMenuStatusLine(status: ComposerMenu.Status(
            words: ComposerMenu.readingBuiltins,
            mark: .waiting,
        ))
        ComposerMenuStatusLine(status: ComposerMenu.Status(
            words: ComposerMenu.builtinsUnavailable,
            mark: .failed,
        ))
    }
    .padding(ArgoSpacing.base)
    .frame(width: 640)
    .argoAppearance()
}
