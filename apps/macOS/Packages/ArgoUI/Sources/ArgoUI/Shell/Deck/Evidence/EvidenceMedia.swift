import ArgoEngine
import SwiftUI

/// What a call SHOWED — the bytes the agent actually looked at. The tier is drawn, not just held:
/// `direct` is the transcript's own embedded block, `derived` is a re-read of the path NOW, and
/// after three renders to one path in a turn those are very often not the same picture.
struct EvidenceMedia: View {
    @Environment(\.argo) private var argo

    let media: MediaEvidence

    @State private var showing = MediaShowing.undecoded

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.base) {
            picture
            caption
        }
        .padding(ArgoSpacing.comfortable)
        // The same breath the feed's gallery takes, over the panel's own text rhythm.
        .padding(.vertical, ArgoFeedRow.shotBreath)
        .frame(maxWidth: .infinity, alignment: .leading)
        .showing(media, in: $showing)
    }

    /// A row with no bytes says so, never with a broken-image glyph: nothing failed to load,
    /// nothing
    /// was ever recorded.
    @ViewBuilder private var picture: some View {
        if let image = showing.picture?.image {
            Image(nsImage: image)
                .resizable()
                .scaledToFit()
                .frame(maxWidth: .infinity, alignment: .leading)
                .clipShape(.rect(cornerRadius: ArgoRadius.control))
        } else {
            Text(MediaProvenance.absence)
                .argoText(ArgoTypography.body)
                .foregroundStyle(argo.color.text.disabled)
        }
    }

    /// Named in words rather than a tier badge: one of these is what the agent saw, the other is
    /// what is on disk now. The words are `MediaProvenance`'s, shared with the feed's gallery.
    private var caption: some View {
        HStack(spacing: ArgoSpacing.snug) {
            Text(media.mediaType)
            if let words = showing.provenance.words {
                Text(words)
            }
        }
        .argoText(ArgoTypography.machineCaption)
        .foregroundStyle(argo.color.text.disabled)
    }
}

#Preview("Evidence media — a call whose bytes the record never kept") {
    EvidenceMedia(media: MediaEvidence(tier: .direct, mediaType: "image/png", bytes: nil))
        .frame(width: 420, height: 160)
        .background(ArgoPalette.graphite.surface.sunken)
        .argoAppearance()
}
