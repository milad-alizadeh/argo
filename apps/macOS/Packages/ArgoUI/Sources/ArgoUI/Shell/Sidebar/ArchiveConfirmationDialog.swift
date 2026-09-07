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
    /// Archive the Sessions named, now that the reader has said so.
    let archive: @MainActor ([String]) -> Void

    func body(content: Content) -> some View {
        content.confirmationDialog(
            pending.map { SessionArchiveProjection.confirmTitle(names: $0.names) } ?? "",
            isPresented: isPresented,
            presenting: pending,
        ) { batch in
            // `.destructive` whichever way the verb reads. Where Argo can end the agent that is
            // literal; where it cannot, taking a working Session off the roster is the loss, and
            // #1596 is what it costs to draw that as an ordinary button. Cancel takes the
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

// The prompt as it is raised: over a stand-in for the surface it covers, naming a Session the way a
// real row does.
//
// The platform owns the chrome here, so what these are for is the WORDS: that the title quotes a
// long name without swallowing it, that the message's sentences read in the order that matters, and
// that the destructive verb and Cancel sit the way macOS puts them.
#Preview("Archive prompt — an agent Argo will end") {
    @Previewable @State var pending: ArchiveConfirmation? = ArchiveConfirmation(sessions: [
        .init(id: "session", name: "Rebuild the roster's archived foot", endsAgent: true),
    ])

    Color.clear
        .frame(width: 420, height: 260)
        .modifier(ArchiveConfirmationDialog(pending: $pending) { _ in })
}

// The state #1596 is about, and the one that used to be drawn as no prompt at all: the row leaves
// the roster and the agent behind it keeps working. Read the verb against the one above — "Anyway"
// is the whole of what stops the button promising an end this window cannot perform.
#Preview("Archive prompt — an agent Argo cannot end") {
    @Previewable @State var pending: ArchiveConfirmation? = ArchiveConfirmation(sessions: [
        .init(id: "session", name: "Rebuild the roster's archived foot", endsAgent: false),
    ])

    Color.clear
        .frame(width: 420, height: 260)
        .modifier(ArchiveConfirmationDialog(pending: $pending) { _ in })
}

// A batch that is both, which is what a roster with a previous run's Sessions still on it produces.
// The counts are what this render is for: they must add up to the title's, and the reader must be
// able to tell from the paragraph alone which half survives.
#Preview("Archive prompt — a mixed batch") {
    @Previewable @State var pending: ArchiveConfirmation? = ArchiveConfirmation(sessions: [
        .init(id: "one", name: "Rebuild the roster's archived foot", endsAgent: true),
        .init(id: "two", name: "Name the Delivery header", endsAgent: true),
        .init(id: "three", name: "Fold the permission line", endsAgent: false),
    ])

    Color.clear
        .frame(width: 420, height: 260)
        .modifier(ArchiveConfirmationDialog(pending: $pending) { _ in })
}
