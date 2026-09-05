import ArgoDesign
import SwiftUI

/// What a markdown picture has to show, which is one of three things and never a silence (#1412).
///
/// A value rather than an optional bitmap beside a flag: a plate must not be able to draw "nothing
/// could be read" over a picture that is still on its way, which two independent fields make
/// possible and one enum does not.
enum FeedPictureShowing {
    /// Nothing yet. The fetch is out, and a wait is not a failure.
    case waiting
    /// Fetched, and there was no picture at the far end of it.
    case unreadable
    case drawn(MediaBitmap)

    /// Whether there is a picture in the box. What the edge and the spoken label both ask.
    var isDrawn: Bool {
        if case .drawn = self {
            return true
        }
        return false
    }

    /// Whether the fetch is still out. A wait is the one state that is not a control: there is
    /// nothing to open yet, and an address that may still turn into a picture is not an answer.
    var isWaiting: Bool {
        if case .waiting = self {
            return true
        }
        return false
    }
}

/// One markdown picture's plate: the fixed box, the ground under it and the edge around it, with
/// whichever of the three states it was handed inside.
///
/// Split from `FeedMarkdownPicture` so each state has a render of its own — a state drawn only
/// behind a live fetch is a state nobody has looked at (`rules/swift.md`, Rendering).
struct FeedPicturePlate: View {
    @Environment(\.argo) private var argo
    @Environment(\.openURL) private var open

    let alt: String
    let source: URL
    let showing: FeedPictureShowing

    var body: some View {
        Button { open(source) } label: { plate }
            .buttonStyle(.plain)
            .help(source.absoluteString)
            .disabled(showing.isWaiting)
            .accessibilityElement(children: .combine)
            .accessibilityLabel(spoken)
            .accessibilityHint(showing.isWaiting ? "" : "Opens this image in the browser")
    }

    @ViewBuilder private var plate: some View {
        switch showing {
        case let .drawn(picture): drawn(picture)
        case .waiting: waiting
        case .unreadable: absence
        }
    }

    /// The picture fitted into the band, which is as wide as the body's own measure. Drawn as an
    /// overlay on a clear frame for `FeedShotView`'s reason: a scaled `Image` reports the size it
    /// scaled TO, so a fit would hand the band the picture's own smaller box back and the ground
    /// would come out short of it.
    private func drawn(_ picture: MediaBitmap) -> some View {
        band {
            Image(nsImage: picture.image)
                .resizable()
                .scaledToFit()
        }
        .background(argo.color.surface.raised)
    }

    /// A picture that is COMING, in the box it will fill. Wordless: the one thing a wait must not
    /// do is say the picture is missing.
    private var waiting: some View {
        band { Color.clear }
            .background(argo.color.surface.sunken)
    }

    /// A source nothing could read, as the words the author wrote for exactly this — and the
    /// address where there were none, since it is the one thing a reader can still act on.
    private var absence: some View {
        band {
            Text(alt.isEmpty ? source.absoluteString : alt)
                .argoText(ArgoTypography.caption)
                .foregroundStyle(argo.color.text.disabled)
                .multilineTextAlignment(.leading)
                .padding(ArgoSpacing.base)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .background(argo.color.surface.sunken)
    }

    /// The box all three states stand in: the measure's own width, the band's height under it, and
    /// the edge around both. One place, so a wait cannot be a different shape from what follows it.
    private func band(@ViewBuilder _ inside: () -> some View) -> some View {
        Color.clear
            .frame(maxWidth: .infinity)
            .aspectRatio(1 / ArgoFeedRow.pictureBand, contentMode: .fit)
            .overlay { inside() }
            .clipShape(.rect(cornerRadius: ArgoRadius.control))
            .overlay { frame }
    }

    /// The edge that says which claim this is — solid around a picture, dashed around a box with
    /// none in it. The gallery's own two answers.
    private var frame: some View {
        RoundedRectangle(cornerRadius: ArgoRadius.control)
            .strokeBorder(
                argo.color.edge.subtle,
                style: StrokeStyle(
                    lineWidth: ArgoStroke.border,
                    dash: showing.isDrawn ? [] : [ArgoStroke.dash],
                ),
            )
    }

    private var spoken: String {
        [alt.isEmpty ? nil : alt, showing.isDrawn ? "Image" : "Image not shown"]
            .compactMap(\.self)
            .joined(separator: ", ")
    }
}

#if DEBUG
    /// The fixtures the three renders above stand on, and nothing ships them: a state drawn only
    /// behind a live fetch is a state nobody can look at.
    private extension URL {
        static let previewPicture = URL(string: "https://example.com/atlas-shading.png")!
    }

    private extension MediaBitmap {
        /// A picture at a screenshot's own ratio, drawn rather than fetched.
        static var previewSwatch: MediaBitmap {
            let pixels = CGSize(width: 1600, height: 1000)
            let image = NSImage(size: pixels)
            image.lockFocus()
            NSColor.systemTeal.setFill()
            NSRect(origin: .zero, size: pixels).fill()
            image.unlockFocus()
            return MediaBitmap(
                image: image,
                header: MediaHeader(
                    pixels: (width: Int(pixels.width), height: Int(pixels.height)),
                    points: pixels,
                ),
                box: .plate(ArgoFeedRow.picturePlate),
            )
        }
    }
#endif

#Preview("Markdown picture — waiting") {
    FeedPicturePlate(alt: "Atlas shading", source: .previewPicture, showing: .waiting)
        .padding(ArgoFeedRow.inset)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Markdown picture — nothing could be read") {
    FeedPicturePlate(alt: "Atlas shading", source: .previewPicture, showing: .unreadable)
        .padding(ArgoFeedRow.inset)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Markdown picture — drawn") {
    FeedPicturePlate(
        alt: "Atlas shading",
        source: .previewPicture,
        showing: .drawn(.previewSwatch),
    )
    .padding(ArgoFeedRow.inset)
    .argoDeckSurface()
    .argoAppearance()
}
