import SwiftUI

/// The control row under the field: the stance, what the Session runs at, and send.
///
/// There is no attach control yet, deliberately — capability is declared, not discovered (design
/// decision 9), and no adapter takes an attachment until #540. The run facts are words rather
/// than a control for the same reason: #558 is where Model and Effort become choices, and a
/// popover that opened onto nothing would be a promise this footer cannot keep.
struct ComposerFooter: View {
    @Environment(\.argo) private var argo

    @Binding var mode: ComposerMode
    let facts: String?
    let isSendable: Bool
    let send: () -> Void

    var body: some View {
        HStack(spacing: ArgoSpacing.base) {
            Spacer()
            ModePicker(mode: $mode)
            if let facts {
                Text(facts)
                    .argoText(ArgoTypography.rowMeta)
                    .foregroundStyle(argo.color.text.secondary)
            }
            SendButton(isSendable: isSendable, send: send)
        }
        .padding(.top, ArgoSpacing.base)
    }
}

#Preview("Composer footer") {
    ComposerFooter(mode: .constant(.code), facts: "Opus 5", isSendable: true, send: {})
        .padding(ArgoSpacing.section)
        .frame(width: 640)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Composer footer — a Session whose record named no model") {
    ComposerFooter(mode: .constant(.code), facts: nil, isSendable: false, send: {})
        .padding(ArgoSpacing.section)
        .frame(width: 640)
        .argoDeckSurface()
        .argoAppearance()
}
