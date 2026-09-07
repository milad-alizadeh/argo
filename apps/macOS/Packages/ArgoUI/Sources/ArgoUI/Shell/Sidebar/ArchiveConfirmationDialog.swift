import SwiftUI

/// The prompt raised before an archive takes a Session with live work in it off the roster
/// (#1290) — whether or not that archive can end the agent behind it (#1596).
///
/// A modifier rather than a block in `CockpitView`'s body: the shell mounts it beside its two
/// sheets, and the words, the roles and the dismissal rule are one thing that belongs together
/// where they can be read at once.
package struct ArchiveConfirmationDialog: ViewModifier {
    /// The archive waiting on an answer, or nothing. Cleared by every way out — the buttons, and
    /// the dismissal below.
    @Binding package var pending: ArchiveConfirmation?
    /// Archive the Sessions named, now that the reader has said so.
    package let archive: @MainActor ([String]) -> Void

    package init(
        pending: Binding<ArchiveConfirmation?>,
        archive: @escaping @MainActor ([String]) -> Void,
    ) {
        _pending = pending
        self.archive = archive
    }

    package func body(content: Content) -> some View {
        content.confirmationDialog(
            pending.map { SessionArchiveProjection.confirmTitle(names: $0.names) } ?? "",
            isPresented: isPresented,
            presenting: pending,
        ) { batch in
            // `.destructive` whichever way the verb reads. Where Argo can end the agent that is
            // literal; where it cannot, taking a working Session off the roster is itself the
            // loss the role is for (#1596). Cancel takes the
            // `.cancel` role and with it the Escape key: the prompt is only ever raised over live
            // work, so every way of dismissing it without choosing leaves that work alone.
            Button(
                SessionArchiveProjection.confirmVerb(ending: batch.ending),
                role: .destructive,
            ) {
                archive(batch.ids)
            }
            Button("Cancel", role: .cancel) {}
        } message: { batch in
            Text(SessionArchiveProjection.confirmMessage(
                ending: batch.ending,
                staying: batch.staying,
            ))
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
