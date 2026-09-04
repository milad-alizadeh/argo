import ArgoAtoms
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
package struct StartControl: View {
    @Environment(\.argo) private var argo

    let verbs: TicketsToolbarIntents.Verbs

    package var body: some View {
        ArgoIconButtonGroup {
            start
            ArgoIconButtonRule()
            ArgoIconButton(
                ArgoSymbol.openOnHost,
                voice: ArgoControlVoice("Open on host"),
                face: ArgoControlFace(ink: argo.color.text.tertiary),
                act: verbs.openOnHost ?? {},
            )
            .disabled(verbs.openOnHost == nil)
            ArgoIconButton(
                ArgoSymbol.copyLink,
                voice: ArgoControlVoice("Copy link"),
                face: ArgoControlFace(ink: argo.color.text.tertiary),
                act: verbs.copyLink ?? {},
            )
            .disabled(verbs.copyLink == nil)
        }
    }

    /// The one control on this row that spends a word. It is the verb the room exists for, and a
    /// glyph on its own would be the unlabelled mark the study cut.
    ///
    /// Not an `ArgoIconButton`: it draws a WORD, so it takes the box's height and whatever width
    /// the verb needs — the one thing on this row that is not square.
    private var start: some View {
        Button(action: verbs.start) {
            StartVerb(command: verbs.command)
                .padding(.horizontal, ArgoSpacing.base)
                .frame(height: ArgoControlBox.icon)
                .contentShape(.capsule)
        }
        .buttonStyle(.plain)
        .help(StartVerb.spoken(verbs.command))
        .accessibilityLabel(StartVerb.spoken(verbs.command))
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(verbs: TicketsToolbarIntents.Verbs) {
        self.verbs = verbs
    }
}

#Preview("Start control") {
    StartControl(verbs: TicketsToolbarIntents.Verbs(command: .implement))
        .padding(ArgoSpacing.region)
        .argoAppearance()
}
