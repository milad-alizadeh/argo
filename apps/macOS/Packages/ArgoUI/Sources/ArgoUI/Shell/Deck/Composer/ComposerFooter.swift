import ArgoDesign
import ArgoEngine
import SwiftUI

/// The control row under the field: `+`, the stance, what the Session runs at, and send.
///
/// One value per control (`ComposerFooterControls`), so this list is the ROW rather than a list of
/// everything on it — and so a control's reading and its acts arrive together or not at all.
///
/// The `+` is ABSENT rather than disabled for a Session offering neither a Workspace nor a
/// command surface — capability is declared, not discovered (design decision 9), and a greyed
/// control gives no reason. The run facts answer to the same rule (#558): they are a trigger where
/// the adapter declares a knob, and words alone where it declares neither.
struct ComposerFooter: View {
    var add = AddButtonControl()
    var mode = ModePickerControl()
    var runFacts = RunFactsControl()
    var send = SendButtonControl()

    var body: some View {
        HStack(spacing: ArgoSpacing.base) {
            if add.canAdd {
                AddButton(isOpen: add.isOpen, toggle: add.toggle)
            }
            Spacer()
            ModePicker(reading: mode.reading, heldMode: mode.heldMode, setMode: mode.setMode)
            RunFactsButton(control: runFacts, mode: mode.reading)
            SendButton(
                isSendable: send.isSendable,
                isRunning: send.isRunning,
                send: send.send,
                stop: send.stop,
            )
        }
        .padding(.top, ArgoSpacing.base)
    }
}

/// The Session every case below varies by one fact: idle, on the defaults, with a `+` to press.
private func atRest() -> ComposerFooter {
    ComposerFooter(
        add: AddButtonControl(canAdd: true),
        mode: ModePickerControl(reading: .exactly(.code, cli: "acceptEdits")),
        runFacts: RunFactsControl(facts: RunFacts(
            model: "claude-opus-5",
            effort: .exactly(.medium, cli: "medium"),
            choosesModel: true,
            choosesEffort: true,
        )),
        send: SendButtonControl(isSendable: true),
    )
}

@MainActor private func framed(_ footer: ComposerFooter) -> some View {
    footer
        .padding(ArgoSpacing.section)
        .frame(width: 640)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Composer footer") {
    framed(atRest())
}

#Preview("Composer footer — a Session whose record named neither fact") {
    var footer = atRest()
    footer.runFacts = RunFactsControl()
    footer.send = SendButtonControl()
    return framed(footer)
}

#Preview("Composer footer — a Session offering neither files nor commands") {
    var footer = atRest()
    footer.add = AddButtonControl()
    return framed(footer)
}

#Preview("Composer footer — a Turn in flight") {
    var footer = atRest()
    footer.send = SendButtonControl(isRunning: true)
    return framed(footer)
}

#Preview("Composer footer — a rung held until the Turn ends") {
    var footer = atRest()
    footer.mode.heldMode = .auto
    footer.send = SendButtonControl(isRunning: true)
    return framed(footer)
}

#Preview("Composer footer — a stance the ladder has no rung for") {
    var footer = atRest()
    footer.mode = ModePickerControl(reading: .nearly(.readOnly, cli: "default"))
    return framed(footer)
}

// Off both defaults, where the fact line brightens (#558) — the pair the trigger's two inks are
// for, rendered rather than described.
#Preview("Composer footer — off the Model and Effort defaults") {
    var footer = atRest()
    footer.runFacts = RunFactsControl(facts: RunFacts(
        model: "claude-sonnet-5",
        effort: .exactly(.xhigh, cli: "xhigh"),
        choosesModel: true,
        choosesEffort: true,
    ))
    return framed(footer)
}
