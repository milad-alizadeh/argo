import SwiftUI

/// The open ticket's own verbs, in one vessel: `Start`, then the two link verbs past a rule.
///
/// **`Start` starts — there is no rung to choose** (`cockpit-work-room.md`). The split control it
/// replaced asked a question with one answer: starting a Session on a ticket IS starting work on
/// it, and `Code` is the rung work needs. The rung stays changeable in the one place that can
/// honestly change it — the composer's `ModePicker`, over a live Session whose rung it reads back.
///
/// The two link verbs are icons rather than rows inside a menu, because nothing in this room is
/// behind an unlabelled control. They DISABLE where the Binding cannot address the ticket in a
/// browser (#872) — drawn and unpressable, rather than live and inert. Disabled and not hidden: the
/// row is a fixed set of marks, and a pair that came and went with the provider would move the
/// ones beside them.
struct StartControl: View {
    @Environment(\.argo) private var argo

    let verbs: TicketsToolbarIntents.Verbs

    var body: some View {
        ToolbarVessel {
            start
            DeckSeparator()
                .frame(height: ArgoTicketsChrome.splitDividerHeight)
                .accessibilityHidden(true)
            ToolbarIcon(
                symbol: ArgoSymbol.openOnHost,
                label: "Open on host",
                act: verbs.openOnHost ?? {},
            )
            .disabled(verbs.openOnHost == nil)
            ToolbarIcon(
                symbol: ArgoSymbol.copyLink, label: "Copy link", act: verbs.copyLink ?? {},
            )
            .disabled(verbs.copyLink == nil)
        }
    }

    /// The one control on this row that spends a word. It is the verb the room exists for, and a
    /// glyph on its own would be the unlabelled mark the study cut.
    private var start: some View {
        Button(action: verbs.start) {
            HStack(spacing: ArgoSpacing.snug) {
                ArgoGlyph(ArgoSymbol.startSession, ArgoTicketsChrome.iconSize)
                Text("Start")
                    .argoText(ArgoTypography.control)
                command
            }
            .foregroundStyle(argo.color.text.secondary)
            .padding(.horizontal, ArgoSpacing.base)
            .frame(height: ArgoTicketsChrome.iconButtonHeight)
            .contentShape(.capsule)
        }
        .buttonStyle(.plain)
        .help(spoken)
        .accessibilityLabel(spoken)
    }

    /// What the press will send, beside the verb rather than only in its tooltip (#899): a press
    /// that silently dispatched one of five different jobs is a press nobody can aim. Quieter ink
    /// than the verb — it is what `Start` will do, not a second control.
    ///
    /// Nothing at all where the ticket asks for no command. `Start` alone is then the whole truth:
    /// the Session opens with an empty composer.
    @ViewBuilder private var command: some View {
        if let command = verbs.command {
            Text("/\(command.rawValue)")
                .argoText(ArgoTypography.machineCaption)
                .foregroundStyle(argo.color.text.tertiary)
        }
    }

    private var spoken: String {
        guard let command = verbs.command else {
            return "Start a Session on this ticket, with an empty composer"
        }
        return "Start a Session on this ticket, on /\(command.rawValue)"
    }
}

#Preview("Start control") {
    StartControl(verbs: TicketsToolbarIntents.Verbs(command: .implement))
        .padding(ArgoSpacing.region)
        .argoAppearance()
}
