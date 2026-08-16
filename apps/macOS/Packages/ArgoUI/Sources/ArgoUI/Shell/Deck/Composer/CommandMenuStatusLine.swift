import SwiftUI

/// One line of `CommandMenuStatus`: a mark, then the words, on a row of the list's own height so
/// the strip and the rows under it stand on one rhythm.
struct CommandMenuStatusLine: View {
    @Environment(\.argo) private var argo

    let words: String
    let mark: Mark

    /// What stands before the words, and the ink both it and they take.
    enum Mark {
        /// Still being asked for — the roster's own waiting dot, so waiting looks like waiting
        /// wherever it happens.
        case waiting
        /// Asked for and refused.
        case failed
    }

    var body: some View {
        HStack(spacing: ArgoSpacing.snug) {
            glyph
            Text(words)
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
        switch mark {
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
        switch mark {
        case .waiting: argo.color.text.tertiary
        case .failed: argo.color.state.attention
        }
    }
}
