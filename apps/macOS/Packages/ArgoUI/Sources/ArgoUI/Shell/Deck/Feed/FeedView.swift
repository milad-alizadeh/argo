import SwiftUI

/// The Session's reading, filling the deck's feed zone.
///
/// It takes rows and nothing else — no Session, no selection, no Hub — so the same view draws a
/// live transcript, a specimen and a preview. What is on screen is what the projection produced,
/// in the order it produced it.
struct FeedView: View {
    let rows: [FeedRow]

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: ArgoFeedRow.gap) {
                ForEach(rows) { row in
                    FeedRowView(row: row)
                }
            }
            .padding(.horizontal, ArgoFeedRow.inset)
            .padding(.vertical, ArgoSpacing.section)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .overlay {
            if rows.isEmpty {
                FeedSilence()
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Feed")
    }
}

/// One row, drawn as what it is.
private struct FeedRowView: View {
    let row: FeedRow

    var body: some View {
        switch row.kind {
        case .prompt: FeedPrompt(text: row.text)
        case .message: FeedProse(text: row.text, voice: .message)
        case .thought: FeedProse(text: row.text, voice: .thought)
        }
    }
}

/// A Session with nothing to show yet. It says so, because a blank feed zone is
/// indistinguishable from one that failed to draw — and the reason is always the same: the kinds
/// this feed draws have not arrived, not that nothing happened.
private struct FeedSilence: View {
    @Environment(\.argo) private var argo

    var body: some View {
        Text("Nothing said yet")
            .argoText(ArgoTypography.body)
            .foregroundStyle(argo.color.text.disabled)
    }
}

#Preview("Feed — a turn read from a transcript") {
    FeedView(rows: FeedProjection.rows(from: CockpitPresentation.Session.preview.events))
        .frame(width: 820, height: 560)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Feed — a deck wide enough to break the measure") {
    FeedView(rows: FeedProjection.rows(from: CockpitPresentation.Session.preview.events))
        .frame(width: 1440, height: 560)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Feed — a Session that has said nothing") {
    FeedView(rows: [])
        .frame(width: 820, height: 320)
        .argoDeckSurface()
        .argoAppearance()
}
