import ArgoEngine
import SwiftUI

/// One picture in a gallery: the thumbnail, its filename and size, and where it came from.
///
/// The four provenances are drawn apart rather than only captioned apart. A caption is read by
/// whoever stops to read it; the frame is read by everyone, and the difference between what the
/// agent SAW and what is on that path now is exactly the difference a reader must not have to
/// squint for. Captured bleeds to its own edges the way a screen capture does; the current file is
/// framed in the broken edge the shell already uses for a weaker claim; a rendered artifact sits
/// mounted on a plate, because it was drawn rather than captured off anything.
struct FeedShotView: View {
    @Environment(\.argo) private var argo

    let shot: FeedShot
    let open: (FeedShot) -> Void

    /// Decoded once per shot rather than in `body`. See `MediaPicture`.
    @State private var picture: MediaPicture?

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
            Button { open(shot) } label: { plate }
                .buttonStyle(.plain)
                .disabled(picture == nil)
            caption
        }
        .frame(width: ArgoFeedRow.shotWidth, alignment: .leading)
        .onChange(of: shot, initial: true) { picture = MediaPicture(shot.media) }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(spoken)
        .accessibilityHint(picture == nil ? "" : "Opens this image full size")
    }

    /// Everything drawn here answers to the picture this view actually decoded, never to the bytes
    /// the record claimed: a shot showing an absence must not also be a control.
    private var provenance: MediaProvenance {
        MediaProvenance(shot.media, showing: picture != nil)
    }

    /// The picture cropped to the shot's own box.
    ///
    /// Drawn as an overlay on a clear frame rather than as a sized `Image`: `scaledToFill` reports
    /// the size it scaled TO, so a landscape shot in a 3:2 box laid out wider than the box and the
    /// ground behind it came out offset from the picture on top of it. The clear frame is the one
    /// thing in the stack with an exact size, and everything else is measured against it.
    @ViewBuilder private var plate: some View {
        if let picture {
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

    /// Three lines and not one run of them: the name, the size, then where the pixels came from.
    /// Joined into a subtitle they were one string too long for the measure, and the half that got
    /// cut was always the provenance — the half the shot exists to be honest about.
    private var caption: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.hair) {
            Text(shot.name)
                .argoText(ArgoTypography.caption)
                .foregroundStyle(argo.color.text.secondary)
                .lineLimit(1)
                .truncationMode(.head)
                .help(shot.address)
            if let size = picture?.spokenSize {
                Text(size)
                    .argoText(ArgoTypography.machineCaption)
                    .foregroundStyle(argo.color.text.disabled)
            }
            if let words = provenance.words {
                Text(words)
                    .argoText(ArgoTypography.caption)
                    .foregroundStyle(argo.color.text.disabled)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var spoken: String {
        [shot.name, picture?.spokenSize, provenance.words ?? MediaProvenance.absence]
            .compactMap(\.self)
            .joined(separator: ", ")
    }

    private var isMounted: Bool {
        provenance.treatment == .mounted
    }

    private var isBroken: Bool {
        provenance.treatment == .broken
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
