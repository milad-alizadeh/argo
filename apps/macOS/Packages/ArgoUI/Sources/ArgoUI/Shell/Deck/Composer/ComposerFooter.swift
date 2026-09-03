import ArgoDesign
import ArgoEngine
import SwiftUI

/// The control row under the field: `+`, the stance, what the Session runs at, and send.
///
/// The `+` is ABSENT rather than disabled for a Session offering neither a Workspace nor a
/// command surface — capability is declared, not discovered (design decision 9), and a greyed
/// control gives no reason. The run facts are words rather than a control for a different reason:
/// #558 is where Model and Effort become choices, and a popover that opened onto nothing would be
/// a promise this footer cannot keep.
struct ComposerFooter: View {
    @Environment(\.argo) private var argo

    /// The Session's stance as Argo can state it (#545). A reading and not a binding: what the
    /// control shows comes back off the Session, so the footer holds no value of its own.
    let mode: SessionModeReading
    let facts: String?
    let isSendable: Bool
    /// Whether a Turn is in flight, which is what turns the trailing control into Stop (#541).
    var isRunning = false
    let send: () -> Void
    /// Stop that Turn. Inert by default, for the reason `canAdd` is `false` by default.
    package var stop: () -> Void = {}
    /// Whether `AddMenu` would have at least one row — `false` takes `AddButton` off the row
    /// entirely rather than greying it (design decision 9, 11). Read off `ComposerMenuLine`
    /// (`workspaceRoot`, `canRunCommands`) and DELIBERATELY not off `canAttach`: a drop and a
    /// paste answer to `canAttach` on their own, through `AttachmentDropTarget`, and `+` no longer
    /// opens a file picker of its own for `canAttach` to gate (design decision 12).
    var canAdd = false
    var isAddMenuOpen = false
    var toggleAddMenu: () -> Void = {}
    /// A rung picked while a Turn was running, held for the boundary (#940). It is what the picker
    /// draws while it waits, under `≈` — never as the rung the Session stands on.
    var heldMode: SessionMode?
    /// Put the Session on a rung. Inert by default, for the reason `stop` is.
    var setMode: (SessionMode) -> Void = { _ in }

    var body: some View {
        HStack(spacing: ArgoSpacing.base) {
            if canAdd {
                AddButton(isOpen: isAddMenuOpen, toggle: toggleAddMenu)
            }
            Spacer()
            ModePicker(reading: mode, heldMode: heldMode, setMode: setMode)
            if let facts {
                Text(facts)
                    .argoText(ArgoTypography.rowMeta)
                    .foregroundStyle(argo.color.text.secondary)
            }
            SendButton(isSendable: isSendable, isRunning: isRunning, send: send, stop: stop)
        }
        .padding(.top, ArgoSpacing.base)
    }
}

#Preview("Composer footer") {
    ComposerFooter(
        mode: .exactly(.code, cli: "acceptEdits"),
        facts: "Opus 5",
        isSendable: true,
        send: {},
        canAdd: true,
    )
    .padding(ArgoSpacing.section)
    .frame(width: 640)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Composer footer — a Session whose record named no model") {
    ComposerFooter(
        mode: .exactly(.code, cli: "acceptEdits"),
        facts: nil,
        isSendable: false,
        send: {},
        canAdd: true,
    )
    .padding(ArgoSpacing.section)
    .frame(width: 640)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Composer footer — a Session offering neither files nor commands") {
    ComposerFooter(
        mode: .exactly(.code, cli: "acceptEdits"),
        facts: "Opus 5",
        isSendable: true,
        send: {},
    )
    .padding(ArgoSpacing.section)
    .frame(width: 640)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Composer footer — a Turn in flight") {
    ComposerFooter(
        mode: .exactly(.code, cli: "acceptEdits"),
        facts: "Opus 5",
        isSendable: false,
        isRunning: true,
        send: {},
        canAdd: true,
    )
    .padding(ArgoSpacing.section)
    .frame(width: 640)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Composer footer — a rung held until the Turn ends") {
    ComposerFooter(
        mode: .exactly(.code, cli: "acceptEdits"),
        facts: "Opus 5",
        isSendable: false,
        isRunning: true,
        send: {},
        canAdd: true,
        heldMode: .auto,
    )
    .padding(ArgoSpacing.section)
    .frame(width: 640)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Composer footer — a stance the ladder has no rung for") {
    ComposerFooter(
        mode: .nearly(.readOnly, cli: "default"),
        facts: "Opus 5",
        isSendable: true,
        send: {},
        canAdd: true,
    )
    .padding(ArgoSpacing.section)
    .frame(width: 640)
    .argoDeckSurface()
    .argoAppearance()
}
