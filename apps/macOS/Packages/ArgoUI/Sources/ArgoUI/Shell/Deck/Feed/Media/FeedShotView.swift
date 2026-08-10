import ArgoEngine
import SwiftUI

/// One picture in a gallery: the thumbnail, and where it came from.
///
/// No caption. The name, the dimensions and the provenance words all belong to the lightbox —
/// the surface a reader opens when they want to know ABOUT the picture — and captioning every
/// thumbnail with them said each three times per row. What stays on the thumbnail is the half a
/// caption cannot carry: the provenances are drawn apart, not captioned apart. Captured bleeds to
/// its own edges the way a screen capture does; the current file is framed in the broken edge the
/// shell already uses for a weaker claim; a rendered artifact sits mounted on a plate, because it
/// was drawn rather than captured off anything. The address survives as the hover's word and the
/// spoken label.
struct FeedShotView: View {
    @Environment(\.argo) private var argo

    let shot: FeedShot
    let open: (FeedShot) -> Void

    /// Decoded once per shot rather than in `body`, and carrying the only provenance this view
    /// answers to: a shot drawing an absence must not also be a control.
    @State private var showing = MediaShowing.undecoded

    var body: some View {
        Button { open(shot) } label: { plate }
            .buttonStyle(.plain)
            .disabled(showing.picture == nil)
            .help(shot.address)
            .frame(width: ArgoFeedRow.shotWidth, alignment: .leading)
            .showing(shot.media, in: $showing)
            .accessibilityElement(children: .combine)
            .accessibilityLabel(spoken)
            .accessibilityHint(showing.picture == nil ? "" : "Opens this image full size")
    }

    /// The picture cropped to the shot's own box.
    ///
    /// Drawn as an overlay on a clear frame rather than as a sized `Image`: `scaledToFill` reports
    /// the size it scaled TO, so a landscape shot in a 3:2 box laid out wider than the box and the
    /// ground behind it came out offset from the picture on top of it. The clear frame is the one
    /// thing in the stack with an exact size, and everything else is measured against it.
    @ViewBuilder private var plate: some View {
        if let picture = showing.picture {
            Color.clear
                .frame(width: pictureWidth, height: pictureHeight)
                .overlay {
                    Image(nsImage: picture.image)
                        .resizable()
                        .scaledToFill()
                }
                .clipped()
                .padding(mount)
                .background(isMounted ? argo.color.surface.overlay : argo.color.surface.raised)
                .clipShape(.rect(cornerRadius: ArgoRadius.control))
                .overlay { frame }
        } else {
            absence
        }
    }

    /// A shot with no picture says so where the picture would have been, in the panel's own words.
    /// Drawn as an empty plate rather than as a glyph: there was never an image here to fail.
    private var absence: some View {
        Text(MediaProvenance.absence)
            .argoText(ArgoTypography.caption)
            .foregroundStyle(argo.color.text.disabled)
            .multilineTextAlignment(.leading)
            .padding(ArgoSpacing.base)
            .frame(width: ArgoFeedRow.shotWidth, height: ArgoFeedRow.shotHeight)
            .background(argo.color.surface.sunken)
            .clipShape(.rect(cornerRadius: ArgoRadius.control))
            .overlay { frame }
    }

    /// The edge that says which claim this is. Solid for what the agent saw and for what the
    /// plugin drew; dashed for a re-read of the path and for an absence — the shell's existing
    /// mark for a boundary that is not what it looks like.
    ///
    /// One ink for all four. The dash is the whole signal: drawing the weaker claims in a quieter
    /// grey as WELL made them read as further away rather than as differently sourced, and at
    /// thumbnail size the quieter grey simply disappeared.
    private var frame: some View {
        RoundedRectangle(cornerRadius: ArgoRadius.control)
            .strokeBorder(
                argo.color.edge.subtle,
                style: StrokeStyle(
                    lineWidth: ArgoStroke.border,
                    dash: isBroken ? [ArgoStroke.dash] : [],
                ),
            )
    }

    private var spoken: String {
        [
            shot.name,
            showing.picture?.spokenSize,
            showing.provenance.words ?? MediaProvenance.absence,
        ]
        .compactMap(\.self)
        .joined(separator: ", ")
    }

    private var isMounted: Bool {
        showing.provenance.treatment == .mounted
    }

    private var isBroken: Bool {
        showing.provenance.treatment == .broken
    }

    private var mount: CGFloat {
        isMounted ? ArgoFeedRow.shotMount : 0
    }

    private var pictureWidth: CGFloat {
        ArgoFeedRow.shotWidth - mount * 2
    }

    private var pictureHeight: CGFloat {
        ArgoFeedRow.shotHeight - mount * 2
    }
}

#Preview("Shot — the four provenances, side by side") {
    HStack(alignment: .top, spacing: ArgoFeedRow.shotGap) {
        ForEach(Array(FeedProjection.previewShots.enumerated()), id: \.offset) { _, shot in
            FeedShotView(shot: shot, open: { _ in })
        }
    }
    .padding(ArgoFeedRow.inset)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Shot — a picture the record kept nothing for") {
    FeedShotView(
        shot: FeedShot(
            name: "lightbox.png",
            address: "docs/designs/renders/lightbox.png",
            media: MediaEvidence(tier: .direct, mediaType: "image/png", bytes: nil),
        ),
        open: { _ in },
    )
    .padding(ArgoFeedRow.inset)
    .argoDeckSurface()
    .argoAppearance()
}
