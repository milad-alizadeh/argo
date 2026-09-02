import ArgoDesign
import ArgoEngine
import SwiftUI

/// What a call SHOWED — the bytes the agent actually looked at. The tier is drawn, not just held:
/// `direct` is the transcript's own embedded block, `derived` is a re-read of the path NOW, and
/// after three renders to one path in a turn those are very often not the same picture.
struct EvidenceMedia: View {
    @Environment(\.argo) private var argo

    let media: MediaEvidence

    @State private var showing = MediaShowing.undecoded

    /// The box the panel draws a picture in: as wide as the panel OPENS in the window Argo opens
    /// at, and unbounded in height — the picture fits the column's width and the panel scrolls.
    /// Dragged wider than that, a picture is drawn soft rather than decoded again: a decode per
    /// frame of a seam drag is what this refuses to pay.
    static let plate = CGSize(
        width: (ArgoLayout.windowIdealWidth - ArgoLayout.sidebarIdealWidth)
            * ArgoLayout.evidencePanelShare,
        height: 0,
    )

    /// How tall a picture that has not arrived yet is drawn, against the plate's width. Two thirds
    /// is about what a window capture is, which is most of what the panel shows.
    static let waitingShare: CGFloat = 2.0 / 3.0

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.base) {
            picture
            caption
        }
        .padding(ArgoSpacing.comfortable)
        // The same breath the feed's gallery takes, over the panel's own text rhythm.
        .padding(.vertical, ArgoFeedRow.shotBreath)
        .frame(maxWidth: .infinity, alignment: .leading)
        .showing(media, drawnIn: .plate(Self.plate), in: $showing)
    }

    /// A row with no bytes says so, never with a broken-image glyph: nothing failed to load,
    /// nothing was ever recorded.
    @ViewBuilder private var picture: some View {
        if let image = showing.picture?.image {
            Image(nsImage: image)
                .resizable()
                .scaledToFit()
                .frame(maxWidth: .infinity, alignment: .leading)
                .clipShape(.rect(cornerRadius: ArgoRadius.control))
        } else if showing.isPending {
            // A picture on its way, in a plate the shape a capture roughly is. The file's own
            // dimensions are not known until it is decoded, so the panel does settle once when the
            // picture lands — a reflow of one row, against the alternative of stating an absence
            // that is about to be contradicted.
            Rectangle()
                .fill(argo.color.surface.sunken)
                .frame(height: Self.plate.width * Self.waitingShare)
                .clipShape(.rect(cornerRadius: ArgoRadius.control))
        } else {
            Text(showing.provenance.instead)
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
