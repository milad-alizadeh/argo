import ArgoDesign
import SwiftUI

/// Whose word a prompt bubble stands on (`CONTEXT.md`, "Honesty tier").
///
/// Two rungs and not the domain's three: a prompt arrives over the record or off Argo's own
/// keystroke, and nothing reaches the feed over the companion channel claiming somebody asked
/// something.
package enum FeedPromptTier: Equatable, Sendable {
    /// The record carried it — DERIVED, and every prompt the feed has ever drawn.
    case recorded
    /// Argo typed it and no record has answered yet (#1278) — DIRECT on Argo's own submit, and
    /// no evidence at all that the CLI heard it.
    case submitted
}

/// What one prompt bubble draws: the words, whatever was pasted with them, and whose word the two
/// stand on.
///
/// One value rather than three parameters, because they are one reading — and because the four
/// together put `FeedPrompt`'s initializer over the arity cap the boundary gate holds
/// (`.swiftlint.yml`, #755). Grouping by the reading is what that gate asks for.
package struct FeedPromptReading: Equatable, Sendable {
    let text: String
    /// What was pasted in with the words. Always empty for a `submitted` reading: nothing is drawn
    /// from a file the CLI has not read yet.
    let shots: [FeedShot]
    let tier: FeedPromptTier

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(text: String, shots: [FeedShot] = [], tier: FeedPromptTier = .recorded) {
        self.text = text
        self.shots = shots
        self.tier = tier
    }
}

/// What was asked, as a bubble on the trailing edge — the one row in the feed that is not the agent
/// speaking. Steering typed mid-run lands here too: a steer is a prompt.
///
/// Unlabelled, because the shape says it; the label survives for screen readers, where it does not.
package struct FeedPrompt: View {
    @Environment(\.argo) private var argo

    /// The words, the pictures pasted with them and the tier the two stand on — see
    /// `FeedPromptReading`. Pictures are drawn as the gallery a call's are: one treatment for a
    /// picture in the feed, whoever put it there (#733). A Turn Argo has typed and nothing has
    /// answered is drawn short of fully present, so it cannot be read as one the transcript
    /// confirmed; it comes up solid in place the moment the record takes its row.
    let prompt: FeedPromptReading
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
            // The WHOLE bubble, which is what `ArgoOpacity` answers for: dimming the words alone
            // would leave the ground of a confirmed prompt under a Turn nothing has confirmed.
            .opacity(prompt.tier == .submitted ? ArgoOpacity.ghosted : ArgoOpacity.full)
            .frame(maxWidth: .infinity, alignment: .trailing)
    }

    /// The bubble's ceiling, its insets, and whether there is more of the prompt than the fold
    /// shows are all `PromptBubbleLayout`'s, decided from the proposal in the pass that makes it —
    /// see that type for why none of the three may be learned through `@State` (#946). WHICH state
    /// the reader has it in stays here, as the line limit on the words below.
    private var bubble: some View {
        PromptBubbleLayout(text: prompt.text) {
            VStack(alignment: .trailing, spacing: ArgoSpacing.snug) {
                // A prompt that was only a picture never reaches here — the gallery fold takes it
                // (#1252) — so in practice this pairs a grid with the words pasted beside it. The
                // empty case is still answered, because an empty block of prose above a thumbnail
                // is a line the reader never wrote.
                if !prompt.shots.isEmpty {
                    FeedGalleryRow(gallery: FeedGallery(shots: prompt.shots), open: open)
                }
                if !prompt.text.isEmpty {
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
        .accessibilityElement(children: prompt.shots.isEmpty ? .combine : .contain)
        .accessibilityLabel(spoken)
    }

    /// The opening word carries the tier, because opacity does not reach a screen reader: `Sent`
    /// says Argo typed these words and nothing has answered them yet.
    private var spoken: String {
        let text = prompt.text
        let shots = prompt.shots
        let opening = prompt.tier == .submitted ? "Sent" : "Prompt"
        guard !shots.isEmpty else { return "\(opening): \(text)" }
        let pictures = shots.count == 1 ? "1 image" : "\(shots.count) images"
        return text.isEmpty ? "\(opening): \(pictures)" : "\(opening): \(text), with \(pictures)"
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
        FeedProseText(text: prompt.text)
            .lineLimit(lineLimit)
            .fixedSize(horizontal: false, vertical: true)
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(
        prompt: FeedPromptReading,
        open: @escaping (FeedShot) -> Void,
        isExpanded: Binding<Bool>,
    ) {
        self.prompt = prompt
        self.open = open
        _isExpanded = isExpanded
    }
}

#Preview("Feed prompt — sent, and no record for it yet") {
    @Previewable @State var isExpanded = false

    FeedPrompt(
        prompt: FeedPromptReading(
            text: "Run the visual contract suite and tell me what broke.",
            tier: .submitted,
        ),
        open: { _ in },
        isExpanded: $isExpanded,
    )
    .padding(ArgoFeedRow.inset)
    .frame(width: 720)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Feed prompt — short enough to stand whole") {
    @Previewable @State var isExpanded = false

    FeedPrompt(
        prompt: FeedPromptReading(
            text: "Run the visual contract suite and tell me what broke.",
        ),
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
        prompt: FeedPromptReading(
            text: String(repeating: "Read the whole anatomy study before you start. ", count: 14),
        ),
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
        prompt: FeedPromptReading(
            text: String(repeating: "Read the whole anatomy study before you start. ", count: 14),
        ),
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
        prompt: FeedPromptReading(text: String(repeating: "Fold me. ", count: 40)),
        open: { _ in },
        isExpanded: $isExpanded,
    )
    .padding(ArgoFeedRow.inset)
    .frame(width: 360)
    .argoDeckSurface()
    .argoAppearance()
}
