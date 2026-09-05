import ArgoDesign
import SwiftUI

/// A picture the record only NAMES — `![alt](source)` — drawn where its alt text used to be
/// (#1412).
///
/// The gallery's own box: the fixed height, the picture's ratio for the width, and the fitted draw
/// that #1015 settled. The height is fixed BEFORE the bytes arrive and does not move when they do,
/// which is what lets `FeedProseFrame` measure the block; the picture is fitted inside it rather
/// than the box grown to the picture.
///
/// Three states, and each says what it is. A picture, drawn. A picture on its way, an empty plate
/// and no words — the alt text under a picture that is coming reads as a failure that has not
/// happened. A source nothing could read, its alt text: the words the author wrote, which is the
/// honest thing to leave standing where the picture cannot be drawn.
struct FeedMarkdownPicture: View {
    @Environment(\.argo) private var argo
    @Environment(\.openURL) private var open

    let alt: String
    let source: URL

    /// Decoded once per source rather than in `body`, which SwiftUI runs whenever anything near it
    /// changes — the same rule every other picture in the feed is drawn under.
    @State private var picture: MediaBitmap?
    @State private var isUnreadable = false

    var body: some View {
        plate
            .frame(height: ArgoFeedRow.shotHeight, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityElement(children: .combine)
            .accessibilityLabel(spoken)
            .task(id: source) { await fetch() }
    }

    @ViewBuilder private var plate: some View {
        if let picture {
            Button { open(source) } label: { drawn(picture) }
                .buttonStyle(.plain)
                .help(source.absoluteString)
                .accessibilityHint("Opens this image in the browser")
        } else if isUnreadable {
            absence
        } else {
            waiting
        }
    }

    /// The picture at its own ratio, fitted into the fixed plate. Drawn as an overlay on a clear
    /// frame for `FeedShotView`'s reason: a scaled `Image` reports the size it scaled TO, so a fit
    /// would hand the plate the picture's own smaller box back and the ground would come out short.
    private func drawn(_ picture: MediaBitmap) -> some View {
        Color.clear
            .frame(width: width(of: picture), height: ArgoFeedRow.shotHeight)
            .overlay {
                Image(nsImage: picture.image)
                    .resizable()
                    .scaledToFit()
            }
            .background(argo.color.surface.raised)
            .clipShape(.rect(cornerRadius: ArgoRadius.control))
            .overlay { frame }
    }

    /// A picture that is COMING, in the box it will fill. Wordless: the one thing a wait must not
    /// do is say the picture is missing.
    private var waiting: some View {
        Rectangle()
            .fill(argo.color.surface.sunken)
            .frame(width: ArgoFeedRow.shotWidth, height: ArgoFeedRow.shotHeight)
            .clipShape(.rect(cornerRadius: ArgoRadius.control))
            .overlay { frame }
    }

    /// A source nothing could read, as the words the author wrote for exactly this. Its own link,
    /// because the address is the one thing a reader can still act on.
    private var absence: some View {
        Button { open(source) } label: {
            Text(alt.isEmpty ? source.absoluteString : alt)
                .argoText(ArgoTypography.caption)
                .foregroundStyle(argo.color.text.disabled)
                .multilineTextAlignment(.leading)
                .padding(ArgoSpacing.base)
                .frame(
                    width: ArgoFeedRow.shotWidth,
                    height: ArgoFeedRow.shotHeight,
                    alignment: .topLeading,
                )
                .background(argo.color.surface.sunken)
                .clipShape(.rect(cornerRadius: ArgoRadius.control))
                .overlay { frame }
        }
        .buttonStyle(.plain)
        .help(source.absoluteString)
    }

    /// The edge that says this box is a picture's, dashed where there is no picture in it — the
    /// gallery's own two answers.
    private var frame: some View {
        RoundedRectangle(cornerRadius: ArgoRadius.control)
            .strokeBorder(
                argo.color.edge.subtle,
                style: StrokeStyle(
                    lineWidth: ArgoStroke.border,
                    dash: picture == nil ? [ArgoStroke.dash] : [],
                ),
            )
    }

    /// How wide the picture is drawn: its own ratio at the fixed height, inside the gallery's own
    /// bounds, and the fixed box where the decode reported no size at all.
    private func width(of picture: MediaBitmap) -> CGFloat {
        let drawn = picture.drawn
        guard drawn.height > 0 else { return ArgoFeedRow.shotWidth }
        return min(
            max(
                ArgoFeedRow.shotHeight * (drawn.width / drawn.height),
                ArgoFeedRow.shotWidths.lowerBound,
            ),
            ArgoFeedRow.shotWidths.upperBound,
        )
    }

    private var spoken: String {
        [alt.isEmpty ? nil : alt, picture == nil ? "Image not shown" : "Image"]
            .compactMap(\.self)
            .joined(separator: ", ")
    }

    /// Whatever is held first, so a picture drawn once is drawn again with no wait, and the fetch
    /// behind it for everything else.
    @MainActor private func fetch() async {
        let pictures = MarkdownPictures.shared
        if let held = pictures.held(source) {
            picture = held
            return
        }
        isUnreadable = pictures.isUnreadable(source)
        guard !isUnreadable else { return }
        let fetched = await pictures.picture(at: source, in: .plate(ArgoFeedRow.shotPlate))
        guard !Task.isCancelled else { return }
        picture = fetched
        isUnreadable = fetched == nil
    }
}

#Preview("Markdown picture — a source nothing can read") {
    FeedMarkdownPicture(alt: "Atlas shading", source: URL(string: "https://example.com/a.png")!)
        .padding(ArgoFeedRow.inset)
        .frame(width: 480)
        .argoDeckSurface()
        .argoAppearance()
}
