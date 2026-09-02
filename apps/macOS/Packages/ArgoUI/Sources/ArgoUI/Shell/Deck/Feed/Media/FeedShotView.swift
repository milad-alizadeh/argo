import ArgoDesign
import ArgoEngine
import SwiftUI

/// One picture in a gallery: the thumbnail, and where it came from. No caption — the name,
/// dimensions and provenance words belong to the lightbox; provenance is drawn instead, and the
/// address survives as the hover's word and the spoken label.
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
            .disabled(!showing.provenance.showsPicture)
            .help(shot.address)
            .frame(width: shot.drawnWidth, alignment: .leading)
            .showing(shot.media, drawnIn: .plate(ArgoFeedRow.shotPlate), in: $showing)
            .accessibilityElement(children: .combine)
            .accessibilityLabel(spoken)
            .accessibilityHint(showing.provenance.showsPicture ? "Opens this image full size" : "")
    }

    /// The picture at its own ratio, drawn to the shot's own box. FITTED and not filled: the box
    /// is already the picture's shape wherever the file said what that is, and where it did not,
    /// a fit letterboxes it inside the fixed plate — which is the whole of #1015, since a fill
    /// cuts the ends off a picture the caption then calls evidence.
    ///
    /// Drawn as an overlay on a clear frame rather than as a sized `Image`, because a scaled
    /// `Image` reports the size it scaled TO: a fit inside the plate would hand the plate the
    /// picture's own smaller box back, and the ground would come out short of the band.
    @ViewBuilder private var plate: some View {
        if let picture = showing.picture {
            Color.clear
                .frame(width: pictureWidth, height: pictureHeight)
                .overlay {
                    Image(nsImage: picture.image)
                        .resizable()
                        .scaledToFit()
                }
                .padding(mount)
                .background(isMounted ? argo.color.surface.overlay : argo.color.surface.raised)
                .clipShape(.rect(cornerRadius: ArgoRadius.control))
                .overlay { frame }
        } else if showing.isPending {
            waiting
        } else {
            absence
        }
    }

    /// A picture that is COMING, in the plate it will fill: read off the file and decoded off the
    /// main actor, so a shot appearing for the first time has a frame or two with nothing to draw.
    /// Wordless — the absence sentence over a picture on its way is the one thing this must not
    /// say, and a shot is too small to say anything else in.
    private var waiting: some View {
        Rectangle()
            .fill(argo.color.surface.sunken)
            .frame(width: shot.drawnWidth, height: ArgoFeedRow.shotHeight)
            .clipShape(.rect(cornerRadius: ArgoRadius.control))
            .overlay { frame }
    }

    /// A shot with no picture says so where the picture would have been, as an empty plate. In the
    /// shot's own box like every other state: the fixed one for a record that kept no bytes, and
    /// the header's own ratio for a run that was cut short after its header and then decoded to
    /// nothing. Either way the box is the one the signature settled, because a width that changed
    /// with what the decode found would be geometry the lane and the ruler cannot see.
    private var absence: some View {
        Text(showing.provenance.instead)
            .argoText(ArgoTypography.caption)
            .foregroundStyle(argo.color.text.disabled)
            .multilineTextAlignment(.leading)
            .padding(ArgoSpacing.base)
            .frame(width: shot.drawnWidth, height: ArgoFeedRow.shotHeight)
            .background(argo.color.surface.sunken)
            .clipShape(.rect(cornerRadius: ArgoRadius.control))
            .overlay { frame }
    }

    /// The edge that says which claim this is. Solid for what the agent saw and for what the plugin
    /// drew; dashed for a re-read of the path and for an absence. One ink for all four: a quieter
    /// grey disappears at thumbnail size.
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
            showing.provenance.words ?? showing.provenance.instead,
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
        shot.drawnWidth - mount * 2
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
