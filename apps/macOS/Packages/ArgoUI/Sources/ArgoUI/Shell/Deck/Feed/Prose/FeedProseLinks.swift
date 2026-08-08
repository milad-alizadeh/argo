import SwiftUI

/// Where the links in a paragraph actually landed on the screen.
///
/// SwiftUI draws a link run inside a `Text` and stops there: no pointer over it, and the pointer
/// is most of what tells a reader a word is pressable before they press it. `pointerStyle` is a
/// modifier on a VIEW, and a run inside a paragraph is not one — so the run's rectangle has to
/// come out of the type-setter, which is the only thing that knows where the words ended up after
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

/// Draws the paragraph unchanged and reports where its link runs are.
///
/// A renderer rather than a measurement pass because wrapping is the whole question: the same
/// paragraph at two widths puts its links in different places, and only the thing that broke the
/// lines knows where.
struct ProseLinkRenderer: TextRenderer {
    let found: ([ProseLinkRun]) -> Void

    func draw(layout: Text.Layout, in context: inout GraphicsContext) {
        found(layout.flatMap { line in
            line.compactMap { run in
                guard let link = run[ProseLink.self] else { return nil }
                return ProseLinkRun(url: link.url, rect: run.typographicBounds.rect)
            }
        })
        for line in layout {
            for run in line {
                context.draw(run)
            }
        }
    }
}

extension View {
    /// The pointer, and the press, over each rectangle a link ended up occupying.
    ///
    /// The press is here too rather than left to SwiftUI's own: a transparent target that took the
    /// pointer and passed the click through to the text under it would be a word that looks
    /// pressable, feels pressable, and does nothing.
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
