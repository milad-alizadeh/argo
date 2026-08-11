import ArgoEngine
import SwiftUI

/// The control row under the field: attach, the stance, what the Session runs at, and send.
///
/// The `+` is ABSENT rather than disabled for an adapter that takes no attachments — capability is
/// declared, not discovered (design decision 9), and a greyed control gives no reason. The run
/// facts are words rather than a control for a different reason: #558 is where Model and Effort
/// become choices, and a popover that opened onto nothing would be a promise this footer cannot
/// keep.
struct ComposerFooter: View {
    @Environment(\.argo) private var argo

    @Binding var mode: ComposerMode
    let facts: String?
    let isSendable: Bool
    /// Whether a Turn is in flight, which is what turns the trailing control into Stop (#541).
    var isRunning = false
    let send: () -> Void
    /// Stop that Turn. Inert by default, for the reason `attach` is absent by default.
    var stop: () -> Void = {}
    /// What the `+` does, and `nil` for a Session whose adapter declares no attachments — which is
    /// what takes the control off the row entirely.
    var attach: (([SessionAttachment]) -> Void)?

    var body: some View {
        HStack(spacing: ArgoSpacing.base) {
            if let attach {
                AttachButton(attach: attach)
            }
            Spacer()
            ModePicker(mode: $mode)
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
        mode: .constant(.code),
        facts: "Opus 5",
        isSendable: true,
        send: {},
        attach: { _ in },
    )
    .padding(ArgoSpacing.section)
    .frame(width: 640)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Composer footer — a Session whose record named no model") {
    ComposerFooter(
        mode: .constant(.code),
        facts: nil,
        isSendable: false,
        send: {},
        attach: { _ in },
    )
    .padding(ArgoSpacing.section)
    .frame(width: 640)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Composer footer — an adapter that takes no attachments") {
    ComposerFooter(mode: .constant(.code), facts: "Opus 5", isSendable: true, send: {})
        .padding(ArgoSpacing.section)
        .frame(width: 640)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Composer footer — a Turn in flight") {
    ComposerFooter(
        mode: .constant(.code),
        facts: "Opus 5",
        isSendable: false,
        isRunning: true,
        send: {},
        attach: { _ in },
    )
    .padding(ArgoSpacing.section)
    .frame(width: 640)
    .argoDeckSurface()
    .argoAppearance()
}
