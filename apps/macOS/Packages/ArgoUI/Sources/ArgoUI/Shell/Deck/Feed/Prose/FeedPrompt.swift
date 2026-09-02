import ArgoDesign
import SwiftUI

/// What was asked, as a bubble on the trailing edge — the one row in the feed that is not the agent
/// speaking. Steering typed mid-run lands here too: a steer is a prompt.
///
/// Unlabelled, because the shape says it; the label survives for screen readers, where it does not.
package struct FeedPrompt: View {
    @Environment(\.argo) private var argo

    let text: String
    /// What was pasted in with the words, above them. Drawn as the gallery a call's pictures get:
    /// one treatment for a picture in the feed, whoever put it there (#733).
    let shots: [FeedShot]
    /// Required, not defaulted: a no-op default would leave a thumbnail drawn as a control and dead
    /// to the click at any call site that forgot it, with nothing to fail.
    let open: (FeedShot) -> Void
    /// Held by the feed, not here: the projection hands the feed a fresh copy of every row as the
    /// transcript grows, and a fold that lived in the row would quietly re-close behind the reader.
    @Binding var isExpanded: Bool

    /// Whether the layout gave the control a box to stand in. Read back AFTER the pass that decided
    /// it, and used for NOTHING that lays out: that is what makes it safe here and makes the same
    /// lateness in a size #946 itself — a late fact the row's cached height never sees.
    @State private var isOffered = false

    package var body: some View {
        bubble
            .frame(maxWidth: .infinity, alignment: .trailing)
    }

    /// The bubble's ceiling, its insets, and whether there is more of the prompt than the fold
    /// shows are all `PromptBubbleLayout`'s, decided from the proposal in the pass that makes it —
    /// see that type for why none of the three may be learned through `@State` (#946). WHICH state
    /// the reader has it in stays here, as the line limit on the words below.
    private var bubble: some View {
        PromptBubbleLayout(text: text) {
            VStack(alignment: .trailing, spacing: ArgoSpacing.snug) {
                // A prompt that was only a picture draws no block of words: an empty one above the
                // thumbnail is a line of prose the reader never wrote.
                if !shots.isEmpty {
                    FeedGalleryRow(gallery: FeedGallery(shots: shots), open: open)
                }
                if !text.isEmpty {
                    prose(lineLimit: isExpanded ? nil : ArgoFeedRow.collapsedPromptLines)
                        .textSelection(.enabled)
                }
            }
            disclosure
        }
        .background(argo.color.surface.raised, in: .rect(cornerRadius: ArgoRadius.popover))
        // The one row narrower than the measure, so the one row that has to say where its keyboard
        // cursor goes. On the bubble and not on the box it is right-aligned in: a ring around that
        // box is the wrong one #533 was filed about.
        .argoFeedCursorShape(radius: ArgoRadius.popover)
        // `contain` where there are pictures, so each thumbnail stays a control of its own; a
        // combined bubble would fuse them into one label nobody can open.
        .accessibilityElement(children: shots.isEmpty ? .combine : .contain)
        .accessibilityLabel(spoken)
    }

    private var spoken: String {
        guard !shots.isEmpty else { return "Prompt: \(text)" }
        let pictures = shots.count == 1 ? "1 image" : "\(shots.count) images"
        return text.isEmpty ? "Prompt: \(pictures)" : "Prompt: \(text), with \(pictures)"
    }

    private var disclosure: some View {
        Button(isExpanded ? "Show less" : "Show more") { isExpanded.toggle() }
            .buttonStyle(.plain)
            .argoText(ArgoTypography.caption)
            .foregroundStyle(argo.color.text.tertiary)
            .fixedSize()
            // How the layout puts the control away where the prompt already stands whole: proposed
            // a box of nothing, it collapses to nothing and the clip leaves nothing drawn. Both
            // floors are stated, because a frame given only a ceiling never shrinks past its own
            // words — which is a control drawn in the corner of a bubble with nothing to unfold.
            .frame(
                minWidth: 0, maxWidth: .infinity,
                minHeight: 0, maxHeight: .infinity,
                alignment: .trailing,
            )
            .clipped()
            .onGeometryChange(for: Bool.self) { $0.size.height > 0 } action: { isOffered = $0 }
            // Stated rather than left to the empty box the layout gave it. What a screen reader
            // makes of a control of no size is not something a package test here can settle, so
            // the control says for itself that it is not on offer.
            .accessibilityHidden(!isOffered)
    }

    private func prose(lineLimit: Int?) -> some View {
        FeedProseText(text: text)
            .lineLimit(lineLimit)
            .fixedSize(horizontal: false, vertical: true)
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(
        text: String,
        shots: [FeedShot],
        open: @escaping (FeedShot) -> Void,
        isExpanded: Binding<Bool>,
    ) {
        self.text = text
        self.shots = shots
        self.open = open
        _isExpanded = isExpanded
    }
}

#Preview("Feed prompt — short enough to stand whole") {
    @Previewable @State var isExpanded = false

    FeedPrompt(
        text: "Run the visual contract suite and tell me what broke.",
        shots: [],
        open: { _ in },
        isExpanded: $isExpanded,
    )
    .padding(ArgoFeedRow.inset)
    .frame(width: 720)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Feed prompt — long enough to fold") {
    @Previewable @State var isExpanded = false

    FeedPrompt(
        text: String(repeating: "Read the whole anatomy study before you start. ", count: 14),
        shots: [],
        open: { _ in },
        isExpanded: $isExpanded,
    )
    .padding(ArgoFeedRow.inset)
    .frame(width: 720)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Feed prompt — unfolded") {
    @Previewable @State var isExpanded = true

    FeedPrompt(
        text: String(repeating: "Read the whole anatomy study before you start. ", count: 14),
        shots: [],
        open: { _ in },
        isExpanded: $isExpanded,
    )
    .padding(ArgoFeedRow.inset)
    .frame(width: 720)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Feed prompt — at the narrowest feed column") {
    @Previewable @State var isExpanded = false

    FeedPrompt(
        text: String(repeating: "Fold me. ", count: 40),
        shots: [],
        open: { _ in },
        isExpanded: $isExpanded,
    )
    .padding(ArgoFeedRow.inset)
    .frame(width: 360)
    .argoDeckSurface()
    .argoAppearance()
}
