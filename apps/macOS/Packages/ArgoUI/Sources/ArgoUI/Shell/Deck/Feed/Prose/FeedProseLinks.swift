import SwiftUI

/// Where the links in a paragraph actually landed on the screen.
///
/// SwiftUI draws a link run inside a `Text` and stops there: no pointer over it. `pointerStyle` is
/// a modifier on a VIEW and a run inside a paragraph is not one, so the run's rectangle has to come
/// out of the type-setter, which is the only thing that knows where the words landed after
/// wrapping.
///
/// Nothing here reads the prose. It reads the marks the agent's own `[text](url)` already made.
struct ProseLink: TextAttribute {
    let url: URL
}

/// One link's words, as laid out. A single link wraps to more than one rectangle, so a run and not
/// a link is the unit.
struct ProseLinkRun: Equatable {
    let url: URL
    let rect: CGRect
}

/// A run the agent wrote between backticks. Carries nothing: where it is, is the whole question,
/// and only the type-setter knows that.
struct ProseCode: TextAttribute {}

/// Draws the paragraph — grounds under its code spans, glyphs on top — and reports where its link
/// runs ended up.
///
/// A renderer rather than a measurement pass: the same paragraph at two widths puts its links and
/// spans in different places, and only the thing that broke the lines knows where.
///
/// Both jobs live in ONE renderer because `textRenderer` is last-one-wins — a second renderer for
/// the spans would silently drop the link reporting, and the links would stop being pressable
/// with nothing to show for it.
struct ProseRenderer: TextRenderer {
    let marked: ArgoColor
    let found: ([ProseLinkRun]) -> Void

    func draw(layout: Text.Layout, in context: inout GraphicsContext) {
        found(layout.flatMap { line in
            line.compactMap { run in
                guard let link = run[ProseLink.self] else { return nil }
                return ProseLinkRun(url: link.url, rect: run.typographicBounds.rect)
            }
        })
        // Every ground first, then every glyph. Drawn run by run interleaved, a span's ground
        // would paint over the tail of the word before it wherever two runs overlap their boxes.
        for line in layout {
            for run in line where run[ProseCode.self] != nil {
                context.fill(
                    Path(roundedRect: ground(run), cornerRadius: ArgoRadius.marker),
                    with: .color(marked.color),
                )
            }
        }
        for line in layout {
            for run in line {
                context.draw(run)
            }
        }
    }

    /// A marked run's chip: its line box, pushed out enough to read as something AROUND the word
    /// rather than a box jammed against it.
    private func ground(_ run: Text.Layout.Run) -> CGRect {
        run.typographicBounds.rect.insetBy(
            dx: -ArgoFeedRow.markedSpanInsetX,
            dy: -ArgoFeedRow.markedSpanInsetY,
        )
    }
}

extension View {
    /// The pointer, and the press, over each rectangle a link ended up occupying. The press is here
    /// too: a transparent target taking the pointer swallows the click SwiftUI's own link would
    /// get.
    func proseLinks(_ runs: [ProseLinkRun]) -> some View {
        overlay {
            ForEach(Array(runs.enumerated()), id: \.offset) { _, run in
                ProseLinkTarget(run: run)
            }
        }
    }
}

private struct ProseLinkTarget: View {
    @Environment(\.openURL) private var open

    let run: ProseLinkRun

    var body: some View {
        Color.clear
            .frame(width: run.rect.width, height: run.rect.height)
            .contentShape(.rect)
            .position(x: run.rect.midX, y: run.rect.midY)
            .pointerStyle(.link)
            .onTapGesture { open(run.url) }
            .accessibilityHidden(true)
    }
}
