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

    @State private var showing = MediaShowing.undecoded

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
        .showing(shot.media, in: $showing)
        .onExitCommand(perform: dismiss)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("\(shot.address), full size")
        .accessibilityAddTraits(.isModal)
        .accessibilityAction(named: "Close", dismiss)
    }

    /// Full size means as large as the deck allows and never larger than the file: blowing a 64pt
    /// icon up to fill a window is the surface inventing detail the bytes do not carry.
    @ViewBuilder private var lit: some View {
        if let picture = showing.picture {
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

    private var subtitle: String {
        [shot.media.mediaType, showing.picture?.spokenSize, showing.provenance.words]
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
    /// A shot with no picture opens nothing, here as well as on the thumbnail that offers no click:
    /// the gallery is not the only way this can be set, and a scrim over a caption with no image
    /// under it is the one state the lightbox has no honest reading of.
    ///
    /// It takes the feed as well as the selection because closing has to hand the keyboard back to
    /// the gallery the picture came from, and the shot alone does not say which row that was.
    func argoLightbox(_ selection: FeedRowSelection, in feed: [FeedRow]) -> some View {
        overlay {
            if let lit = selection.lit, lit.isOpenable {
                FeedLightbox(shot: lit) { selection.darken(returningInto: feed) }
                    // Focused so `onExitCommand` reaches it at all: it only fires for a view in the
                    // responder chain, and until this nothing put the lightbox in one.
                    .focusable()
                    .focused(selection.focus, equals: .lightbox)
                    .transition(.opacity)
            }
        }
        .argoAnimation(.reveal, value: selection.lit)
    }
}

#Preview("Lightbox — a shot opened over the deck") {
    Color.clear
        .argoDeckSurface()
        .overlay {
            if let shot = FeedProjection.previewShots.first {
                FeedLightbox(shot: shot, dismiss: {})
            }
        }
        .frame(width: 900, height: 620)
        .argoAppearance()
}
