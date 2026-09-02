import ArgoDesign
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
            StartVerb(command: verbs.command)
                .padding(.horizontal, ArgoSpacing.base)
                .frame(height: ArgoTicketsChrome.iconButtonHeight)
                .contentShape(.capsule)
        }
        .buttonStyle(.plain)
        .help(StartVerb.spoken(verbs.command))
        .accessibilityLabel(StartVerb.spoken(verbs.command))
    }
}

#Preview("Start control") {
    StartControl(verbs: TicketsToolbarIntents.Verbs(command: .implement))
        .padding(ArgoSpacing.region)
        .argoAppearance()
}
