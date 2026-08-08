import SwiftUI

/// The Session's reading, filling the deck's feed zone.
///
/// It takes rows and nothing else — no Session, no selection, no Hub — so the same view draws a
/// live transcript, a specimen and a preview. What is on screen is what the projection produced,
/// in the order it produced it.
struct FeedView: View {
    let rows: [FeedRow]

    /// Which prompts the reader has unfolded. Held here rather than in the row: the stack is lazy,
    /// so a row's own state dies the moment it scrolls out of view.
    @State private var unfolded: Set<FeedRow.ID> = []

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: ArgoFeedRow.gap) {
                ForEach(rows) { row in
                    FeedRowView(row: row, isExpanded: unfolding(row.id))
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

    private func unfolding(_ id: FeedRow.ID) -> Binding<Bool> {
        Binding(
            get: { unfolded.contains(id) },
            set: { isOn in
                if isOn {
                    unfolded.insert(id)
                } else {
                    unfolded.remove(id)
                }
            },
        )
    }
}

/// One row, drawn as what it is.
private struct FeedRowView: View {
    let row: FeedRow
    @Binding var isExpanded: Bool

    var body: some View {
        switch row.kind {
        case .prompt: FeedPrompt(text: row.text, isExpanded: $isExpanded)
        case .message: FeedProse(text: row.text, voice: .message)
        case .thought: FeedProse(text: row.text, voice: .thought)
        }
    }
}

/// A feed with no row in it. It says so, because a blank zone is indistinguishable from one that
/// failed to draw.
///
/// A claim about this SURFACE and not about the Session: an agent can be busy in kinds this feed
/// does not draw yet, and "nothing said" would be a reading of the record rather than of the feed.
private struct FeedSilence: View {
    @Environment(\.argo) private var argo

    var body: some View {
        Text("Nothing to read yet")
            .argoText(ArgoTypography.body)
            .foregroundStyle(argo.color.text.disabled)
    }
}

#Preview("Feed — a turn read from a transcript") {
    FeedView(rows: FeedProjection.previewRows)
        .frame(width: 820, height: 560)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Feed — a deck wide enough to break the measure") {
    FeedView(rows: FeedProjection.previewRows)
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
