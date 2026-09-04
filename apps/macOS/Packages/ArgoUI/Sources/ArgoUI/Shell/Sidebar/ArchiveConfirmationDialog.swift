import SwiftUI

/// The prompt raised before an archive ends a running agent (#1290).
///
/// A modifier rather than a block in `CockpitView`'s body: the shell mounts it beside its two
/// sheets, and the words, the roles and the dismissal rule are one thing that belongs together
/// where they can be read at once.
struct ArchiveConfirmationDialog: ViewModifier {
    /// The archive waiting on an answer, or nothing. Cleared by every way out — the buttons, and
    /// the dismissal below.
    @Binding var pending: ArchiveConfirmation?
    /// Archive the Session named, now that the reader has said so.
    let archive: @MainActor (String) -> Void

    func body(content: Content) -> some View {
        content.confirmationDialog(
            pending.map { SessionArchiveProjection.confirmTitle(name: $0.name) } ?? "",
            isPresented: isPresented,
            presenting: pending,
        ) { session in
            // `.destructive`, because this ends a running agent. Cancel takes the `.cancel` role
            // and with it the Escape key: the prompt is only ever raised over live work, so every
            // way of dismissing it without choosing leaves that work alone.
            Button(SessionArchiveProjection.confirmVerb, role: .destructive) {
                archive(session.id)
            }
            Button("Cancel", role: .cancel) {}
        } message: { _ in
            Text(SessionArchiveProjection.confirmMessage)
        }
    }

    /// Up exactly while there is an archive waiting on an answer. Going down drops it and performs
    /// nothing, which is what cancelling means here: the Session keeps both its agent and its row.
    private var isPresented: Binding<Bool> {
        Binding(
            get: { pending != nil },
            set: { isUp in
                guard !isUp else { return }
                pending = nil
            },
        )
    }
}

// The prompt as it is raised: over a stand-in for the surface it covers, naming a Session the way a
// real row does. ONE render, because the prompt has one state — it is up, or there is nothing to
// draw at all.
//
// The platform owns the chrome here, so what this is for is the WORDS: that the title quotes a long
// name without swallowing it, that the message's two sentences read in the order that matters, and
// that the destructive verb and Cancel sit the way macOS puts them.
#Preview("Archive prompt — over a running Session") {
    @Previewable @State var pending: ArchiveConfirmation? = ArchiveConfirmation(
        id: "session",
        name: "Rebuild the roster's archived foot",
    )

    Color.clear
        .frame(width: 420, height: 260)
        .modifier(ArchiveConfirmationDialog(pending: $pending) { _ in })
}
