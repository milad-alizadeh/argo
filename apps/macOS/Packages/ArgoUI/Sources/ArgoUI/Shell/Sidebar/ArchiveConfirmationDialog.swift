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
