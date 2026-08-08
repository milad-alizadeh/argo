import SwiftUI

/// One picture, opened over the deck at the size it actually is.
///
/// It covers the whole deck rather than the feed column, because the column is a reading measure
/// and a screenshot taken at deck width does not fit in it. Everything is a way out: the scrim is
/// the button, the picture is inside the button, and Escape answers as well — a reader who opened
/// this with a click should never have to find a particular pixel to close it.
///
/// The caption is the WHOLE path plus the provenance, which is more than the thumbnail said. Down
/// in the gallery the shot stands beside its neighbours and a filename places it; here it is alone
/// on the deck, and the address is the only thing that says which of six renders this one was.
struct FeedLightbox: View {
    @Environment(\.argo) private var argo

    let shot: FeedShot
    let dismiss: () -> Void

    @State private var picture: MediaPicture?

    var body: some View {
        Button(action: dismiss) {
            VStack(spacing: ArgoSpacing.comfortable) {
                lit
                caption
            }
            .padding(ArgoFeedRow.lightboxInset)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(argo.color.surface.scrim)
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .onChange(of: shot, initial: true) { picture = MediaPicture(shot.media) }
        .onExitCommand(perform: dismiss)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("\(shot.address), full size")
        .accessibilityAddTraits(.isModal)
        .accessibilityAction(named: "Close", dismiss)
    }

    /// Full size means as large as the deck allows and never larger than the file: blowing a 64pt
    /// icon up to fill a window is the surface inventing detail the bytes do not carry.
    @ViewBuilder private var lit: some View {
        if let picture {
            Image(nsImage: picture.image)
                .resizable()
                .scaledToFit()
                .frame(
                    maxWidth: picture.naturalSize.width,
                    maxHeight: picture.naturalSize.height,
                )
                .clipShape(.rect(cornerRadius: ArgoRadius.popover))
        }
    }

    private var caption: some View {
        VStack(spacing: ArgoSpacing.hair) {
            Text(shot.address)
                .argoText(ArgoTypography.body)
                .foregroundStyle(argo.color.text.secondary)
                .lineLimit(1)
                .truncationMode(.head)
            Text(subtitle)
                .argoText(ArgoTypography.machineCaption)
                .foregroundStyle(argo.color.text.tertiary)
        }
    }

    /// Built from the picture this view decoded, so the words under a shot cannot outlive it.
    private var provenance: MediaProvenance {
        MediaProvenance(shot.media, showing: picture != nil)
    }

    private var subtitle: String {
        [shot.media.mediaType, picture?.spokenSize, provenance.words]
            .compactMap(\.self)
            .joined(separator: " · ")
    }
}

extension View {
    /// The lightbox, laid over whatever it is applied to.
    ///
    /// A modifier rather than a view the deck composes, because a picture opened full size has to
    /// cover every zone of the deck at once — the feed it was clicked in, the panel beside it and
    /// the rail — and the only place that is one view is the deck's own outermost body.
    ///
    /// The fade is `reveal`, so it answers Reduce Motion the way every other disclosure in the
    /// shell does: the change still registers, it just stops moving.
    func argoLightbox(_ shot: Binding<FeedShot?>) -> some View {
        overlay {
            if let lit = shot.wrappedValue {
                FeedLightbox(shot: lit) { shot.wrappedValue = nil }
                    .transition(.opacity)
            }
        }
        .argoAnimation(.reveal, value: shot.wrappedValue)
    }
}

#Preview("Lightbox — a shot opened over the deck") {
    Color.clear
        .argoDeckSurface()
        .argoLightbox(.constant(FeedProjection.previewShots.first))
        .frame(width: 900, height: 620)
        .argoAppearance()
}
