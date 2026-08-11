import SwiftUI

/// What stands where the composer would be for a Session that cannot be driven (#546, design
/// decision 7): a mark, the reading, and the sentence saying why in one line.
///
/// A ROW at the deck's foot and not a vessel over the feed — it replaces the reading's end rather
/// than letting it run underneath, so it takes its own height.
struct ComposerUnavailable: View {
    @Environment(\.argo) private var argo

    let reason: SessionComposerProjection.Unavailable
    /// Start a fresh Session in this one's folder. Inert by default, so a specimen draws the line
    /// without spawning an agent.
    var spawn: () async -> Void = {}
    /// Draws the wait without one, for the render harness — see `NewSessionButton.isStarting`.
    @State var isStarting = false

    var body: some View {
        VStack(spacing: ArgoSpacing.flush) {
            DeckSeparator()
            line
        }
        .background(argo.color.surface.sunken)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(reason.announcement)
    }

    private var line: some View {
        HStack(spacing: ArgoSpacing.base) {
            ArgoGlyph(reason.mark, .inline)
                .foregroundStyle(argo.color.text.tertiary)
            sentence
            Spacer(minLength: ArgoSpacing.base)
            if reason.offersFreshSession {
                exit
            }
        }
        .padding(.horizontal, ArgoSpacing.section)
        .frame(height: ArgoComposerVessel.unavailableHeight)
    }

    /// The reading and its reason as ONE line, so the sentence wraps behind the word rather than
    /// under it — two `Text`s in an `HStack` would break at the dash on a narrow deck and leave the
    /// word stranded on a line of its own.
    private var sentence: some View {
        (word + Text(" — " + reason.detail).foregroundStyle(argo.color.text.tertiary))
            .argoText(ArgoTypography.body)
            .lineLimit(2)
    }

    /// The reading itself, so it survives a glance that reads nothing else on the row.
    private var word: Text {
        Text(reason.word)
            .fontWeight(.semibold)
            .foregroundStyle(argo.color.text.secondary)
    }

    /// The one act available on a Session past steering. Named for the branch rather than spelled
    /// `New Session`, which is the button already on the toolbar.
    private var exit: some View {
        Button(action: start) {
            if isStarting {
                ProgressView().controlSize(.small)
            } else {
                Text(Self.exitLabel).argoText(ArgoTypography.caption)
            }
        }
        .buttonStyle(.bordered)
        .controlSize(.small)
        // A bordered button reads the TINT for its label and its fill, and ignores a
        // `foregroundStyle` set anywhere around it (the trap #608's Mode menu recorded). Left to
        // itself the label comes out Ion Blue and reads as a link; the study draws it neutral.
        .tint(argo.color.text.secondary)
        .disabled(isStarting)
        .accessibilityHint("Starts an agent in the folder this Session was running in")
    }

    private static let exitLabel = "New Session on this branch"

    /// Lowered whichever way the spawn went, for `NewSessionButton.start`'s reason: a refusal
    /// reports itself in an alert, and a control still spinning behind it claims otherwise.
    private func start() {
        isStarting = true
        Task {
            await spawn()
            isStarting = false
        }
    }
}

#Preview("Composer unavailable — a Session Argo never owned") {
    ComposerUnavailable(reason: .external)
        .frame(width: 900)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Composer unavailable — a Session whose PTY died") {
    ComposerUnavailable(reason: .orphaned)
        .frame(width: 900)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Composer unavailable — a Session its agent reported over") {
    ComposerUnavailable(reason: .ended)
        .frame(width: 900)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Composer unavailable — the exit mid-spawn") {
    ComposerUnavailable(reason: .orphaned, isStarting: true)
        .frame(width: 900)
        .argoDeckSurface()
        .argoAppearance()
}
