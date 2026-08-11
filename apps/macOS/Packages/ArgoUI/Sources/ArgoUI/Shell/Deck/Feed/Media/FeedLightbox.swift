import SwiftUI

/// One picture, opened over the deck at the size it actually is. It covers the whole deck rather
/// than the feed column, which is a reading measure a deck-width screenshot does not fit in.
/// Everything is a way out: the scrim is the button, the picture is inside it, and Escape answers.
/// The caption is the WHOLE path plus the provenance, which is more than the thumbnail said.
struct FeedLightbox: View {
    @Environment(\.argo) private var argo

    let shot: FeedShot
    let dismiss: () -> Void

    @State private var showing = MediaShowing.undecoded

    var body: some View {
        ZStack {
            // The scrim lands at full dim on the first frame; faded WITH the picture, the reading
            // stays bright under a half-opaque overlay the whole way in and reads as a flicker. On
            // the way out it fades with the picture, or a ghost of the image floats over bright
            // text. Independent transitions only work because the CONTAINER'S transition is
            // `.identity` (see `argoLightbox`) — a parent opacity composites both layers into one
            // translucent group again.
            Rectangle()
                .fill(argo.color.surface.scrim)
                .transition(.asymmetric(insertion: .identity, removal: .opacity))
            Button(action: dismiss) {
                VStack(spacing: ArgoSpacing.comfortable) {
                    lit
                    caption
                }
                .padding(ArgoFeedRow.lightboxInset)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .contentShape(.rect)
            }
            .buttonStyle(.plain)
            .transition(.opacity)
        }
        .showing(shot.media, in: $showing)
        .onExitCommand(perform: dismiss)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("\(shot.address), full size")
        .accessibilityAddTraits(.isModal)
        .accessibilityAction(named: "Close", dismiss)
    }

    /// Full size means as large as the deck allows and never larger than the file.
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
    /// The lightbox, laid over whatever it is applied to — a modifier rather than a view the deck
    /// composes, because it has to cover every zone of the deck at once and the only place that is
    /// one view is the deck's own outermost body.
    ///
    /// The fade is `reveal`, so it answers Reduce Motion. A shot with no picture opens nothing.
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
                    // `.identity`, never `.opacity`: a transition here composites the WHOLE
                    // lightbox into one translucent group and the reading burns through it for the
                    // length of the fade. The layers carry their own (see `FeedLightbox.body`).
                    .transition(.identity)
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
