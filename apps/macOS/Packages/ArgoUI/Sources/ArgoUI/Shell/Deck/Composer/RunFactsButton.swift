import ArgoDesign
import ArgoEngine
import SwiftUI

/// `Opus 5 · Medium` on the footer — what the Session runs at, and the way into changing it (#558).
///
/// **A fact line, not a capsule with a chevron.** It is the deck header's own dim `·`-separated
/// idiom and stays chromeless until hovered, because at the defaults there is nothing here worth a
/// reader's attention. It BRIGHTENS off the defaults, which is the one state that is.
///
/// An adapter that chooses neither knob gets the words and no button at all — a trigger that
/// opened onto an empty popover would be a promise this footer cannot keep. That is the same rule
/// `AddButton` is absent under (design decision 9): capability is declared, not discovered.
struct RunFactsButton: View {
    @Environment(\.argo) private var argo

    /// What this control says, what it does, and whether it starts open — see `RunFactsControl`.
    let control: RunFactsControl
    /// The Session's stance, for the reset's sentence alone — the reset names Mode among what it
    /// restores, and a reset that said "default" would make the reader open it to find out.
    /// Mode itself is NOT drawn in the popover: it is on the footer beside this (decision 1).
    let mode: SessionModeReading

    @State private var isOpen = false
    @State private var isHovered = false

    var body: some View {
        if facts.canOpen {
            trigger
        } else {
            words
        }
    }

    private var trigger: some View {
        Button { isOpen = true } label: { words }
            .buttonStyle(.plain)
            .onHover { isHovered = $0 }
            .help("What this Session runs at — \(facts.words)")
            .accessibilityLabel("Model and Effort, \(facts.words)")
            .popover(isPresented: $isOpen, arrowEdge: .bottom) {
                RunSettingsPopover(control: control, mode: mode)
                    .presentationBackground(.regularMaterial)
            }
            .onAppear { isOpen = control.isOpenForRender }
    }

    /// The words alone. `machineCaption` rather than `rowMeta`, which is the deck header's idiom
    /// the design names: a model name and a rung are both machine facts, and the header sets its
    /// own beside them the same way.
    private var words: some View {
        Text(facts.words)
            .argoText(ArgoTypography.machineCaption)
            .foregroundStyle(ink)
    }

    /// What this control says, unwrapped once so the body above reads as the design does.
    private var facts: RunFacts {
        control.facts
    }

    /// Quiet at the defaults, brighter off them, and brighter again under the pointer. An
    /// `unknown` on either side counts as off the defaults, because a fact Argo could not
    /// establish is exactly the one worth looking at.
    private var ink: ArgoColor {
        guard facts.isDefault, !isHovered else { return argo.color.text.primary }
        return argo.color.text.secondary
    }
}

/// One control at a state, framed the way the footer frames it.
@MainActor private func button(_ facts: RunFacts, mode: SessionMode = .code) -> some View {
    RunFactsButton(
        control: RunFactsControl(facts: facts),
        mode: .exactly(mode, cli: "acceptEdits"),
    )
}

/// A reading on an adapter that declares BOTH knobs — the state every case below but the last
/// varies. Shared with `RunSettingsPopover`'s previews, which draw the other half of this control.
func bothKnobs(_ model: String?, _ effort: SessionEffortReading) -> RunFacts {
    RunFacts(model: model, effort: effort, chooses: .both)
}

#Preview("Run facts — at the defaults") {
    button(bothKnobs("claude-opus-5", .exactly(.medium, cli: "medium")))
        .padding(ArgoSpacing.section)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Run facts — off the defaults, and off Argo's own table") {
    VStack(alignment: .trailing, spacing: ArgoSpacing.base) {
        button(bothKnobs("claude-sonnet-5", .exactly(.xhigh, cli: "xhigh")))
        // Verbatim on both halves: an id the table has never heard of, and a level off the ladder.
        button(bothKnobs("claude-mythos-7", .unknown(cli: "ludicrous")))
        // Neither fact established — the word itself, never a plausible value.
        button(bothKnobs(nil, .unknown(cli: nil)))
    }
    .padding(ArgoSpacing.section)
    .argoDeckSurface()
    .argoAppearance()
}

// An adapter that declares neither knob: the words stay, and there is nothing to open.
#Preview("Run facts — an adapter that chooses neither") {
    button(RunFacts(model: "claude-opus-5", effort: .exactly(.medium, cli: "medium")))
        .padding(ArgoSpacing.section)
        .argoDeckSurface()
        .argoAppearance()
}
